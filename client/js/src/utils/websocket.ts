import { ServerSentEventMessage } from "../types";

export function thenable_reject<T>(error: T): PromiseLike<never> {
	return {
		then: (
			resolve: (value: never) => PromiseLike<never>,
			reject: (error: T) => PromiseLike<never>
		) => reject(error)
	};
}

export function websocket_iterator(url: string | URL): WebsocketIteratorReturn {
	const websocket = new WebSocket(url);
	let done = false;

	const values: (
		| IteratorResult<MessageEvent<ServerSentEventMessage | CloseEvent>>
		| PromiseLike<never>
	)[] = [];
	const resolvers: ((
		value: IteratorResult<MessageEvent> | PromiseLike<never>
	) => void)[] = [];

	function close(event?: MessageEvent<CloseEvent>): void {
		done = true;
		if (event) push({ value: event, done: false });
		while (resolvers.length > 0)
			(resolvers.shift() as (typeof resolvers)[0])({
				value: undefined,
				done: true
			});
		websocket.close();
	}

	function push(
		data:
			| {
					value: MessageEvent<ServerSentEventMessage | CloseEvent>;
					done: boolean;
			  }
			| PromiseLike<never>
	): void {
		if (done) return;
		if (resolvers.length > 0) {
			(resolvers.shift() as (typeof resolvers)[0])(data);
		} else {
			values.push(data);
		}
	}

	function pushError(error: unknown): void {
		push(thenable_reject(error));
		close();
	}

	function pushEvent(event: MessageEvent): void {
		push({ value: event, done: false });
	}

	function next(): Promise<
		IteratorResult<MessageEvent<ServerSentEventMessage>>
	> {
		if (values.length > 0)
			return Promise.resolve(values.shift() as (typeof values)[0]);
		if (done) return Promise.resolve({ value: undefined, done: true });
		return new Promise((resolve) => resolvers.push(resolve));
	}

	function init_ws(): void {
		websocket.addEventListener("close", (e) => close(e));
		websocket.addEventListener("error", pushError);
		websocket.addEventListener("message", pushEvent);
	}

	if (websocket.readyState === WebSocket.CONNECTING) {
		websocket.addEventListener("open", (event) => {
			init_ws();
		});
	} else {
		init_ws();
	}

	const iterator = {
		[Symbol.asyncIterator]: () => iterator,
		next,
		throw: async (value: MessageEvent<ServerSentEventMessage>) => {
			pushError(value);
			if (websocket.readyState === WebSocket.OPEN) websocket.close();
			return next();
		},
		return: async () => {
			close();
			if (websocket.readyState === WebSocket.OPEN) websocket.close();
			return next();
		},
		close,
		send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
			websocket.send(data);
		}
	};

	return iterator;
}

interface WebsocketIteratorReturn {
	[Symbol.asyncIterator]: () => WebsocketIteratorReturn;
	next: () => Promise<IteratorResult<MessageEvent, WebsocketIteratorReturn>>;
	throw: (
		value: unknown
	) => Promise<IteratorResult<MessageEvent, WebsocketIteratorReturn>>;
	return: () => Promise<IteratorResult<MessageEvent, WebsocketIteratorReturn>>;
	close: () => void;
	send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
}
