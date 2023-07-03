/**
 * Script loader
 *
 * @param {?(string|object)} [name=<script data-var>] the property name in the current context (which probably is window) where this script should be written to.
 *                                                     - if <varName> is an object, it will be used as the code container.
 *                                                     - if <varName> is undefined or null, the code is directly injected in the current context (window or this) instead of being embedded in a single object.
 *                                                     - if <varName> is otherwise false or empty, the object containing the code is only returned by the function, not placed in any context.
 *                                                     - if <varName> already exists in the context, it is reused and current code is merged into it.
 */
((cat, id, varName = document?.currentScript?.dataset?.var, autoVersion, Script) => {
	const curScript = (varName === undefined || varName === null) ? this : (varName ? (typeof varName === "object" ? varName : this[varName]??{}) : {});
	if (varName && (typeof varName === "string")) this[varName] = curScript;

	Script = Script || ((typeof _jsUtilsLoader === "undefined" || !_jsUtilsLoader) ? varName?._jsUtilsLoader : _jsUtilsLoader)?.Script;
	const _ = Script ? new Script(id, autoVersion) : {
		setLaunchDependencies(deps) { Object.keys(deps).forEach(k => { this[k] = Object.assign(curScript, window[k] ?? (curScript !== window) ? window : {} ); }); },
		content(content) { return content; }
	};

	return Object.assign(curScript, _.content({
		async toBase64Url(url) {
			return fetch(url)
			.then(response => response.blob())
			.then(blob => new Promise((resolve, reject) => {
				const reader = new FileReader()
				reader.onloadend = () => resolve(reader.result)
				reader.onerror = reject
				reader.readAsDataURL(blob)
			}));
		},
		async toBase64UrlLocalFile(container, callback) {
			return new Promise(resolve => {
				container.insertAdjacentHTML("beforeend", `<input type="file" />`);
				const elem = container.lastChild;
				elem.onchange = function() {
					const file = this.files[0];
					const reader = new FileReader();
					reader.onloadend = function() {
						callback(reader.result, elem);
						resolve(reader.result, elem);
					}
					reader.readAsDataURL(file);
				};
			});
		},
	}));
})();