/**
 * Script loader
 *
 * Start the script with : [scriptName].launchScript().then(process);
 *
 * @param {?(string|object)} [name=<script data-var>] : the property name in the current context (which probably is window) where this script should be written to.
 *     - if <varName> is an object, it will be used as the code container.
 *     - if <varName> is undefined or null, the code is directly injected in the current context (window or this) instead of being embedded in a single object.
 *     - if <varName> is otherwise false or empty, the object containing the code is only returned by the function, not placed in any context.
 *     - if <varName> already exists in the context, it is reused and current code is merged into it.
 *
 * @param {?(number|string)} [name=<script data-load>] : the script(s) to load - comma separated list
 *     - it can be either the script name (eg. 0.type_assign.js) or just its ID (eg. 0)
 *
 * Examples :
 *   load the script in window.u with 2 sub scripts (0 => 0.type_assign.js and 1 => 1.DOM.js):
 *     <script type="text/javascript" src="/utils/javascript/Loader.js" data-var="u" data-load="0, 1"></script>
 *
 *   load the script directly in window with 1 declared sub script (3.net.js => 3) which will load 0.type_assign.js as a dependency:
 *     <script type="text/javascript" src="/utils/javascript/Loader.js" data-load="3.net.js"></script>
 *
 *   to allow loading local script on windows it is necessary to add the following line in addition to - and just after - the previous script declaration:
 *     <script type="text/javascript" data-drive="/C:">if (typeof _jsUtilsLoader === "undefined") document.write(document.querySelector("script[data-load]")?.outerHTML.replace(/(?<=src=(["']))(?:\/\w:(?=\/))?([^\1]+)/, document.currentScript.dataset.drive + "$2"));</script>
 *     it may also be wise to create a junction (symbolic link) to the "utils" directory at the start of the drive.
 *
 *   load only this script without using Loader.js:
 *     <script type="text/javascript" data-var="util" src="5.b64img.js"></script>
 */
((cat, id, varName = document?.currentScript?.dataset?.var, autoVersion, Script) => {
	const curScript = (varName === undefined || varName === null) ? this : (varName ? (typeof varName === "object" ? varName : this[varName]??{}) : {});
	if (varName && (typeof varName === "string")) this[varName] = curScript;

	Script = Script || ((typeof _jsUtilsLoader === "undefined" || !_jsUtilsLoader) ? curScript?._jsUtilsLoader : _jsUtilsLoader)?.Script;
	const _ = Script ? new Script(id, autoVersion) : {
		setLaunchDependencies(deps) { Object.keys(deps).forEach(k => { this[k] = Object.assign(curScript, window[k] ?? (curScript !== window) ? window : {} ); }); },
		content(content) { return content; }
	};

	return Object.assign(curScript, _.content({
		toBase64Url(url, fetchOpts) {
			return fetch(url, fetchOpts)
				.then(response => response.blob())
				.then(blob => new Promise((resolve, reject) => {
					const reader = new FileReader()
					reader.onloadend = () => resolve(reader.result)
					reader.onerror = reject
					reader.readAsDataURL(blob)
				}));
		},
		toBase64UrlLocalFile(container, callback) {
			return new Promise(resolve => {
				container.insertAdjacentHTML("beforeend", `<input type="file" />`);
				const elem = container.lastChild;
				elem.onchange = function() {
					const file = this.files[0];
					const reader = new FileReader();
					reader.onloadend = function() {
						callback?.(reader.result, elem);
						resolve(reader.result, elem);
					}
					reader.readAsDataURL(file);
				};
			});
		},
		toPNGLocalFile(container, callback, width, height) {
			return new Promise(resolve => {
				container.insertAdjacentHTML('beforeend', '<div style="display:block; text-align: left;"></div>');
				container = container.lastChild;
				resolve(container);
				const canvas = document.createElement("canvas");
				let inputWidth, inputHeight;
				this.toBase64UrlLocalFile(container, (b64url, elem) => {
					console.log(container.firstChild, elem);
					if (!inputWidth) {
						container.insertAdjacentHTML('beforeend', '<br/><label for="imgWidth">width:</label>&nbsp;<input name="imgWidth" type="text" size="5" />&nbsp;<label for="imgHeight">height:</label>&nbsp;<input name="imgHeight" type="text" size="5" />&nbsp;<input type="button" value="DL"/><br/>');
						inputWidth = container.querySelector("input[name='imgWidth']");
						inputHeight = container.querySelector("input[name='imgHeight']");
						inputDL = container.querySelector("input[type='button']");
						container.appendChild(canvas);
					}
					const img = new Image();
					img.addEventListener("load", (ev) => {
						const w = width ?? "auto", h = height ?? "auto";
						inputWidth.value = w;
						inputHeight.value = h;
						inputWidth.onchange = resize;
						inputHeight.onchange = resize;
						inputDL.onclick = () => {
							const a = document.createElement("a");
							a.href = canvas.toDataURL("image/png");
							a.download = elem.files[0].name.replace(/(\.[^.]+)?$/, `-${canvas.width}x${canvas.height}.png`);
							document.body.appendChild(a);
							a.click();
							setTimeout(function() {
								document.body.removeChild(a);
							}, 0);
						}
						resize();
						//window.location = canvas.toDataURL('image/png')
					}, false);
					img.src = b64url;

					function resize() {
						let w = inputWidth.value, h = inputHeight.value;
						if (w === "auto" && h === "auto") {
							w = img.width, h = img.height;
						} else if (w === "auto") {
							w = h * (img.width / img.height);
						} else if (h === "auto") {
							h = w * (img.height / img.width);
						}
						canvas.width = w;
						canvas.height = h;
						const ctx = canvas.getContext("2d");
						ctx.drawImage(img, 0, 0, w, h);
					}
				});
			});
		},
	}));
})();
