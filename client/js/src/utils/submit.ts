/* eslint-disable complexity */
import type {
	Status,
	Payload,
	EventType,
	ListenerMap,
	SubmitReturn,
	EventListener,
	Event,
	JsApiData,
	EndpointInfo,
	ApiInfo,
	Config,
	Dependency,
	StreamResponse,
	MessageData
} from "../types";

import { is_skip_queue, post_message } from "../helpers/data";
import { resolve_root } from "../helpers/init_helpers";
import { handle_message, process_endpoint } from "../helpers/api_info";
import { BROKEN_CONNECTION_MSG, QUEUE_FULL_MSG } from "../constants";
import { apply_diff_stream, close_stream } from "./stream";
import { Client } from "../client";

export async function submit(
	this: Client,
	endpoint: string | number,
	data: unknown[],
	event_data?: unknown,
	trigger_id?: number | null
): Promise<SubmitReturn> {
	try {
		const { hf_token } = this.options;
		const {
			fetch,
			app_reference,
			config,
			session_hash,
			api_info,
			api_map,
			stream_status,
			pending_stream_messages,
			pending_diff_streams,
			event_callbacks,
			unclosed_events,
			post_data,
			open_stream,
			jwt,
			stream
		} = this;

		if (!api_info) throw new Error("No API found");
		if (!config) throw new Error("Could not resolve app config");

		let { fn_index, endpoint_info, dependency } = get_endpoint_info(
			api_info,
			endpoint,
			api_map,
			config
		);

		let websocket: WebSocket;
		let stream_response: StreamResponse | null = null;
		let protocol = config.protocol ?? "ws";
		const controller = new AbortController();

		const _endpoint = typeof endpoint === "number" ? "/predict" : endpoint;
		let payload: Payload;
		let event_id: string | null = null;
		let complete: Status | undefined | false = false;
		// const listener_map: ListenerMap<EventType> = {};
		let last_status: Record<string, Status["stage"]> = {};
		let url_params =
			typeof window !== "undefined"
				? new URLSearchParams(window.location.search).toString()
				: "";

		async function cancel(): Promise<void> {
			const _status: Status = {
				stage: "complete",
				queue: false,
				time: new Date()
			};
			complete = _status;
			// yield {
			// 	..._status,
			// 	type: "status",
			// 	endpoint: _endpoint,
			// 	fn_index: fn_index
			// };

			let cancel_request = {};
			if (protocol === "ws") {
				if (websocket && websocket.readyState === 0) {
					websocket.addEventListener("open", () => {
						websocket.close();
					});
				} else {
					websocket.close();
				}
				cancel_request = { fn_index, session_hash };
			} else {
				controller.abort();
				cancel_request = { event_id };
			}

			try {
				if (!config) {
					throw new Error("Could not resolve app config");
				}

				await fetch(`${config.root}/reset`, {
					headers: { "Content-Type": "application/json" },
					method: "POST",
					body: JSON.stringify(cancel_request)
				});
			} catch (e) {
				console.warn(
					"The `/reset` endpoint could not be called. Subsequent endpoint results may be unreliable."
				);
			}
		}

		function destroy(): void {
			controller.abort();
		}

		const _payload = await this.handle_blob(config.root, data, endpoint_info);

		const skip_queue = is_skip_queue(fn_index, config);

		payload = {
			data: _payload || [],
			event_data,
			fn_index,
			trigger_id
		};

		async function* submit_generator(): StreamResponse {
			if (!config) throw new Error("Could not resolve app config");

			yield {
				type: "status",
				stage: "pending",
				queue: !skip_queue,
				endpoint: _endpoint,
				fn_index,
				time: new Date()
			};

			if (skip_queue) {
				// handle_post_submit();
			} else if (protocol == "ws") {
				// handle_ws_submit();
			} else if (protocol == "sse") {
				// yield {
				// 	type: "status",
				// 	stage: "pending",
				// 	queue: true,
				// 	endpoint: _endpoint,
				// 	fn_index,
				// 	time: new Date()
				// });

				var params = new URLSearchParams({
					fn_index: fn_index.toString(),
					session_hash: session_hash
				}).toString();
				let url = new URL(
					`${config.root}/queue/join?${
						url_params ? url_params + "&" : ""
					}${params}`
				);

				if (jwt) {
					url.searchParams.set("__sign", jwt);
				}

				stream_response = await stream(url, controller.signal, {
					headers: {
						authorization: "Bearer " + hf_token
					}
				});

				if (!stream_response) {
					return Promise.reject(
						new Error("Cannot connect to SSE endpoint: " + url.toString())
					);
				}

				for await (const message of stream_response) {
					// message?.
					if (!message.data) throw new Error("Stream message is undefined");

					let _data = JSON.parse(message?.data);
					if (_data.msg === "close_stream") {
						close_stream(stream_status, controller);
						return;
					}

					const { type, status, data } = handle_message(
						_data,
						last_status[fn_index]
					);

					if (type === "update" && status && !complete) {
						// call 'status' listeners
						yield {
							type: "status",
							endpoint: _endpoint,
							fn_index,
							time: new Date(),
							...status
						};
						if (status.stage === "error") {
							controller.abort();
						}
					} else if (type === "data") {
						event_id = _data.event_id as string;
						let [_, status] = await post_data(`${config.root}/queue/data`, {
							...payload,
							session_hash,
							event_id
						});
						if (status !== 200) {
							yield {
								type: "status",
								stage: "error",
								message: BROKEN_CONNECTION_MSG,
								queue: true,
								endpoint: _endpoint,
								fn_index,
								time: new Date()
							};
							controller.abort();
						}
					} else if (type === "complete") {
						complete = status;
					} else if (type === "log") {
						yield {
							type: "log",
							log: data.log,
							level: data.level,
							endpoint: _endpoint,
							fn_index
						};
					} else if (type === "generating") {
						yield {
							type: "status",
							time: new Date(),
							...status,
							stage: status?.stage!,
							queue: true,
							endpoint: _endpoint,
							fn_index
						};
					}
					if (data) {
						yield {
							type: "data",
							time: new Date(),
							data: data.data,
							endpoint: _endpoint,
							fn_index,
							event_data,
							trigger_id
						};

						if (complete) {
							yield {
								type: "status",
								time: new Date(),
								...complete,
								stage: status?.stage!,
								queue: true,
								endpoint: _endpoint,
								fn_index
							};
							controller.abort();
						}
					}
				}

				// stream.onmessage = async function (event: MessageEvent) {
			} else if (
				protocol == "sse_v1" ||
				protocol == "sse_v2" ||
				protocol == "sse_v2.1" ||
				protocol == "sse_v3"
			) {
				// latest API format. v2 introduces sending diffs for intermediate outputs in generative functions, which makes payloads lighter.
				// v3 only closes the stream when the backend sends the close stream message.

				const [response, status] = await zero_gpu_auth(
					dependency,
					config,
					payload,
					session_hash,
					url_params,
					post_data
				);

				if (status === 503) {
					yield {
						type: "status",
						stage: "error",
						message: QUEUE_FULL_MSG,
						queue: true,
						endpoint: _endpoint,
						fn_index,
						time: new Date()
					};
				} else if (status !== 200) {
					yield {
						type: "status",
						stage: "error",
						message: BROKEN_CONNECTION_MSG,
						queue: true,
						endpoint: _endpoint,
						fn_index,
						time: new Date()
					};
				} else {
					event_id = response.event_id as string;

					for await (const message of open_stream()) {
						// console.log("SUBMIT_GENERATOR", message);
						const _message = handle_stream_message({
							event: message,
							complete,
							last_status,
							payload,
							session_hash,
							_endpoint,
							fn_index,
							event_data,
							trigger_id,
							protocol,
							pending_diff_streams,
							event_id
						});

						if (_message) {
							if (Array.isArray(_message)) {
								for (const msg of _message) {
									yield msg;
								}
							} else {
								yield _message;
							}
						}

						// yield _message;
					}

					// 	for await (const message of handle_ws_submit({
					// 		app_reference,
					// 		config,
					// 		payload,
					// 		session_hash,
					// 		_endpoint,
					// 		fn_index,
					// 		event_data,
					// 		trigger_id,
					// 		url_params,
					// 		jwt,
					// 		last_status,
					// 		protocol,
					// 		pending_diff_streams,
					// 		event_id
					// 	})) {
					// 		yield message;
					// 	}

					// 	if (event_id in pending_stream_messages) {
					// 		pending_stream_messages[event_id].forEach((msg) => callback(msg));
					// 		delete pending_stream_messages[event_id];
					// 	}
					// 	// @ts-ignore
					// 	event_callbacks[event_id] = callback;
					// 	unclosed_events.add(event_id);
					// 	// if (!stream_status.open) {
					// 	// 	this.open_stream();
					// 	// }
					// }
				}
			}
		}

		// payload = {
		// 	data: _payload || [],
		// 	event_data,
		// 	fn_index,
		// 	trigger_id
		// };

		return {
			cancel,
			destroy,
			async *[Symbol.asyncIterator]() {
				yield* submit_generator();
			}
		};
	} catch (error) {
		console.error("Submit function encountered an error:", error);
		throw error;
	}
}

function get_endpoint_info(
	api_info: ApiInfo<JsApiData>,
	endpoint: string | number,
	api_map: Record<string, number>,
	config: Config
): {
	fn_index: number;
	endpoint_info: EndpointInfo<JsApiData>;
	dependency: Dependency;
} {
	let fn_index: number;
	let endpoint_info: EndpointInfo<JsApiData>;
	let dependency: Dependency;

	if (typeof endpoint === "number") {
		fn_index = endpoint;
		endpoint_info = api_info.unnamed_endpoints[fn_index];
		dependency = config.dependencies[endpoint];
	} else {
		const trimmed_endpoint = endpoint.replace(/^\//, "");

		fn_index = api_map[trimmed_endpoint];
		endpoint_info = api_info.named_endpoints[endpoint.trim()];
		dependency = config.dependencies[api_map[trimmed_endpoint]];
	}

	if (typeof fn_index !== "number") {
		throw new Error(
			"There is no endpoint matching that name of fn_index matching that number."
		);
	}
	return { fn_index, endpoint_info, dependency };
}

async function handle_post_submit<K extends EventType>(
	config: Config,
	payload: Payload,
	session_hash: string,
	_endpoint: string,
	fn_index: number,
	event_data: unknown,
	trigger_id: number | null,
	post_data: (
		url: string,
		data: any,
		headers?: Headers
	) => Promise<[any, number]>,
	url_params: string | undefined
): Promise<MessageData | MessageData[]> {
	try {
		const [output, status_code] = await post_data(
			`${config.root}/run${
				_endpoint.startsWith("/") ? _endpoint : `/${_endpoint}`
			}${url_params ? "?" + url_params : ""}`,
			{
				...payload,
				session_hash
			}
		);

		const data = output.data as any;
		if (status_code == 200) {
			return [
				{
					type: "data",
					endpoint: _endpoint,
					fn_index,
					data: data,
					time: new Date(),
					event_data,
					trigger_id
				},
				{
					type: "status",
					endpoint: _endpoint,
					fn_index,
					stage: "complete",
					eta: output.average_duration,
					queue: false,
					time: new Date()
				}
			];
		}
		return {
			type: "status",
			stage: "error",
			endpoint: _endpoint,
			fn_index,
			message: output.error,
			queue: false,
			time: new Date()
		};
	} catch (e: any) {
		return {
			type: "status",
			stage: "error",
			message: e.message,
			endpoint: _endpoint,
			fn_index,
			queue: false,
			time: new Date()
		};
	}
}

import { websocket_iterator } from "./websocket";
async function* handle_ws_submit<K extends EventType>({
	app_reference,
	hf_token,
	config,
	payload,
	session_hash,
	_endpoint,
	fn_index,
	event_data,
	trigger_id,
	url_params,
	jwt,
	last_status,
	protocol,
	pending_diff_streams,
	event_id
}: {
	app_reference: string;
	hf_token: `hf_${string}`;
	config: Config;
	payload: Payload;
	session_hash: string;
	_endpoint: string;
	fn_index: number;
	event_data: unknown;
	trigger_id: number | null;

	url_params: string | undefined;
	jwt: string | null;
	last_status: Record<string, Status["stage"]>;
	protocol: string;
	pending_diff_streams: Record<string, any>;
	event_id: string | null;
}): AsyncGenerator<MessageData> {
	const { ws_protocol, host } = await process_endpoint(app_reference, hf_token);

	let url = new URL(
		`${ws_protocol}://${resolve_root(
			host,
			config.path as string,
			true
		)}/queue/join${url_params ? "?" + url_params : ""}`
	);

	if (jwt) {
		url.searchParams.set("__sign", jwt);
	}

	const websocket = websocket_iterator(url);
	let complete: Status | undefined | false = false;
	for await (const event of websocket) {
		const message = handle_stream_message({
			websocket,
			event,
			complete,
			last_status,
			payload,
			session_hash,
			_endpoint,
			fn_index,
			event_data,
			trigger_id,
			protocol,
			pending_diff_streams,
			event_id
		});

		if (message) {
			if (Array.isArray(message)) {
				for (const msg of message) {
					yield msg;
				}
				// message.forEach((msg) => yield msg);
			} else {
				yield message;
			}
		}

		if (
			message &&
			!Array.isArray(message) &&
			message.type === "status" &&
			message.stage === "complete"
		) {
			complete = {
				queue: message.queue,
				code: message.code,
				success: message.success,
				stage: "complete",
				broken: message.broken,
				size: message.size,
				position: message.position,
				eta: message.eta,
				message: message.message,
				progress_data: message.progress_data,
				time: message.time
			};
		}
	}
}

function handle_stream_message({
	websocket,
	event,
	complete,
	last_status,
	payload,
	session_hash,
	_endpoint,
	fn_index,
	event_data,
	trigger_id,
	protocol,
	pending_diff_streams,
	event_id
}: {
	websocket?: ReturnType<typeof websocket_iterator>;
	event: MessageEvent;
	complete: Status | undefined | false;
	last_status: Record<string, Status["stage"]>;
	payload: Payload;
	session_hash: string;
	_endpoint: string;
	fn_index: number;
	event_data: unknown;
	trigger_id: number | null;
	protocol: string;
	pending_diff_streams: Record<string, any>;
	event_id: string | null;
}): MessageData | undefined | MessageData[] {
	// console.log("handle_stream_message", event);
	// websocket.onclose = (evt) => {
	try {
		if (event.type === "close" && !event.wasClean) {
			return {
				type: "status",
				stage: "error",
				broken: true,
				message: BROKEN_CONNECTION_MSG,
				queue: true,
				endpoint: _endpoint,
				fn_index,
				time: new Date()
			};
		}
		// };

		// console.log(event);

		// if (event.type === "message" && event.data) {
		const _data = websocket ? JSON.parse(event.data) : event;
		const { type, status, data } = handle_message(_data, last_status[fn_index]);
		let message_data: MessageData[] = [];

		// console.log("data", data);
		// console.log("type", type);
		// console.log("status", status);

		console.log("EVENT");

		if (data) {
			message_data.push({
				type: "data",
				time: new Date(),
				data: data.data,
				endpoint: _endpoint,
				fn_index,
				event_data,
				trigger_id
			});

			if (complete) {
				websocket?.close();
				message_data.push({
					type: "status",
					time: new Date(),
					...complete,
					stage: status?.stage!,
					queue: true,
					endpoint: _endpoint,
					fn_index
				});
			}
		}

		if (type === "update" && status && !complete) {
			// call 'status' listeners
			if (status.stage === "error") {
				websocket?.close();
			}
			message_data.push({
				type: "status",
				endpoint: _endpoint,
				fn_index,
				time: new Date(),
				...status
			});
		} else if (type === "hash") {
			websocket?.send(JSON.stringify({ fn_index, session_hash }));
			return;
		} else if (type === "data") {
			websocket?.send(JSON.stringify({ ...payload, session_hash }));
		} else if (type === "complete") {
			// complete = status;
			message_data.push({
				type: "status",
				time: new Date(),
				...status,
				stage: status?.stage!,
				queue: true,
				endpoint: _endpoint,
				fn_index
			});
		} else if (type == "unexpected_error") {
			console.error("Unexpected error", status?.message);
			message_data.push({
				type: "status",
				stage: "error",
				message: status?.message || "An Unexpected Error Occurred!",
				queue: true,
				endpoint: _endpoint,
				fn_index,
				time: new Date()
			});
		} else if (type === "log") {
			message_data.push({
				type: "log",
				log: data.log,
				level: data.level,
				endpoint: _endpoint,
				fn_index
			});
		} else if (type === "generating") {
			if (data && ["sse_v2", "sse_v2.1", "sse_v3"].includes(protocol)) {
				apply_diff_stream(pending_diff_streams, event_id!, data);
			}
			message_data.push({
				type: "status",
				time: new Date(),
				...status,
				stage: status?.stage!,
				queue: true,
				endpoint: _endpoint,
				fn_index
			});
		}

		return message_data;
		// }
	} catch (e) {
		console.error("Unexpected client exception", e);
		return {
			type: "status",
			stage: "error",
			message: "An Unexpected Error Occurred!",
			queue: true,
			endpoint: _endpoint,
			fn_index,
			time: new Date()
		};
	}
	// different ws contract for gradio versions older than 3.6.0
	//@ts-ignore
	// if (semiver(config.version || "2.0.0", "3.6") < 0) {
	// 	addEventListener("open", () =>
	// 		websocket?.send(JSON.stringify({ hash: session_hash }))
	// 	);
	// }
}

function zero_gpu_auth(
	dependency: Dependency,
	config: Config,
	payload: Payload,
	session_hash: string,
	url_params: string | undefined,
	post_data: (url: string, data: any, headers?: Headers) => Promise<unknown[]>
): Promise<unknown[]> {
	let hostname = "";
	if (typeof window !== "undefined") {
		hostname = window?.location?.hostname;
	}

	let hfhubdev = "dev.spaces.huggingface.tech";
	const origin = hostname.includes(".dev.")
		? `https://moon-${hostname.split(".")[1]}.${hfhubdev}`
		: `https://huggingface.co`;
	const zerogpu_auth_promise =
		dependency.zerogpu && window.parent != window && config.space_id
			? post_message<Headers>("zerogpu-headers", origin)
			: Promise.resolve(undefined);
	return zerogpu_auth_promise.then((headers) => {
		return post_data(
			`${config.root}/queue/join?${url_params}`,
			{
				...payload,
				session_hash
			},
			headers
		);
	});
}
