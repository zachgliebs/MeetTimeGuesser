import getTimes from "./mainControl.js";

/**
 * @typedef {Object} Env
 */

export default {
	/**
	 * @param {Request} request
	 * @param {Env} env
	 * @param {ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		
		console.log(`Hello ${navigator.userAgent} at path ${url.pathname}!`);
		if (url.pathname != "/time") return new Response("Not found", {
			status: 404
		});
		if (request.method.toUpperCase() != "GET") return new Response("Bad method", {
			status: 405
		});

		let id = url.searchParams.get("id");
		return new Response(await getTimes(id), {
			status: 200,
			headers: {
				"content-type": "text/plain",
			},
		});
	},
};
