import { client } from "./dist/index.js";

const app = await client("mahiatlinux/MasherAI-v6-7B-Chat");
const result = await app.predict("/chat", [
	"Hello!!", // string  in 'Message' Textbox component
	"Hello!!", // string  in 'System prompt' Textbox component
	1, // number (numeric value between 1 and 2048) in 'Max new tokens' Slider component
	0.1, // number (numeric value between 0.1 and 4.0) in 'Temperature' Slider component
	0.05, // number (numeric value between 0.05 and 1.0) in 'Top-p (nucleus sampling)' Slider component
	1, // number (numeric value between 1 and 1000) in 'Top-k' Slider component
	1 // number (numeric value between 1.0 and 2.0) in 'Repetition penalty' Slider component
]);

console.log(result.data);
