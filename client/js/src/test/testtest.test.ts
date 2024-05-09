import { Client } from "..";
import { beforeAll, afterEach, afterAll, it, expect, describe } from "vitest";

describe("Client", () => {
	it("should be able to create a new instance of the Client class", async () => {
		const client = await Client.connect("gradio/hello_world");

		const result = await client.submit("/predict", [
			"Hello!!" // string  in 'name' Textbox component
		]);

		console.log(result);
		let count = 0;
		for await (const message of result) {
			count++;
			console.log("MESSAGE: ", count);
			console.log(message);
		}
	}, 10000);
});
