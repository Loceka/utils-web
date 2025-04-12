/**
 * Script loader
 *
 * @param {?(string|object)} [name=<script data-var>] the property name in the current context (which probably is window) where this script should be written to.
 *                                                     - if <varName> is an object, it will be used as the code container.
 *                                                     - if <varName> is undefined or null, the code is directly injected in the current context (window or this) instead of being embedded in a single object.
 *                                                     - if <varName> is otherwise false or empty, the object containing the code is only returned by the function, not placed in any context.
 *                                                     - if <varName> already exists in the context, it is reused and current code is merged into it.
 */
const _jsUtilsLoader = ((varName = document?.currentScript?.dataset?.var, loadScripts = document?.currentScript?.dataset?.load) => {
	Object.prototype.atPath = function(path, defVal) { return String(path ?? "").split(/(?<!\\)\./).reduce((o, p) => o?.[p.replace(/\\\./g, ".")], this) ?? defVal; };
	Object.prototype.setAtPath = function(path, value) { return String(path ?? "").split(/(?<!\\)\./).reduce((o, p, i, a) => (p = p.replace(/\\\./g, "."), (o[p] = (i === a.length - 1) ? value : o[p] ?? {}), o[p]), this); };

	const unsetVarName = varName === undefined || varName === null;
	const curScript = unsetVarName ? this : (varName ? (typeof varName === "object" ? varName : this.atPath(varName, {})) : {});
	if (varName && (typeof varName === "string")) this.setAtPath(varName, curScript);

	const subScripts = {
		"0": "0.type_assign.js",
		"1": "1.DOM.js",
		"2": "2.events.js",
		"3": "3.net.js",
		"4": "4.order_filter.js",
		"5": "5.b64img.js",
		"6": "6.CSS.js",
	};

	const scripts = {}, clientLoadedIds = {}, curDir = document.currentScript?.src?.replace(/[^\/]+$/, "");
	let dependencies = {}, startCB = [], loadCB = [];

	function addScript(script) {
		scripts[script.id] = script;
		if (!varName && !unsetVarName) Object.assign(curScript, script.code);
		dependencies[script.id]?.forEach(cb => cb(script.code));
		delete dependencies[script.id];
		clientLoadedIds[script.id] = true;
	}

	function exec() {
		startCB.forEach(cb => cb());
		new Promise(resolve => {
			if (document.body) {
				resolve();
			} else if (window.addEventListener) {
				window.addEventListener('load', resolve, {capture:true, once:true, passive:true});
			}
		}).then(() => {
			loadCB.forEach(cb => cb());
			dependencies = startCB = loadCB = undefined;
		});
	}

	function clientLoadScript(scriptNameOrId) {
		const scriptId = getScriptId(String(scriptNameOrId));
		if (loadScripts && !(scriptId in clientLoadedIds)) { // do not execute if there are no client loaded scripts
			const scriptElem = document.createElement("script");
			scriptElem.setAttribute("type", "text/javascript");
			scriptElem.setAttribute("src", curDir + (subScripts?.[scriptId] ?? scriptNameOrId));
			if (!unsetVarName) scriptElem.dataset.var = varName;
			document.head.appendChild(scriptElem);
			clientLoadedIds[scriptId] = false;
		}
	}

	function getScriptId(urlOrNameOrId) {
		return urlOrNameOrId?.replace(/^.*?(?:^|\/)(\d+)[^\/]*$/, "$1");
	}

	function Script(id, version) {
		this.id = id ?? getScriptId(document.currentScript?.src);
		this.version = version;
	}
	Script.prototype.has = function(depId) { return depId in scripts; };
	Script.prototype.setCompileDependencies = function(deps) {
		Object.entries(deps).forEach(([depVar, depIds]) => {
			const callback = (script) => { this[depVar] = Object.assign(this[depVar] ?? {}, script); };
			(Array.isArray(depIds) ? depIds : [depIds]).forEach(depId => {
				if (scripts[depId]) {
					callback(scripts[depId]);
				} else {
					(dependencies[depId] || (dependencies[depId] = [])).push(callback);
					clientLoadScript(depId);
				}
			});
		});
	};
	Script.prototype.setLaunchDependencies = Script.prototype.setCompileDependencies;
	Script.prototype.setOptionalDependencies = Script.prototype.setCompileDependencies;
	Script.prototype.onstart = function(callback){ startCB.push(callback); };
	Script.prototype.onload = function(callback){ loadCB.push(callback); };
	Script.prototype.content = function(content) {
		if (content && !this.code) {
			this.code = content;
			addScript(this);
		}
		return this.code;
	};

	return Object.assign(curScript, {
		exec: exec,
		Script: Script,
		loaded: new Promise(resolve => {
			if (loadScripts) {
				window.setTimeout(function() {
					loadScripts.split(/\s*,\s*/g).forEach(clientLoadScript);
					let i = 0;
					const intervalId = setInterval(() => {
						if (Object.values(clientLoadedIds).filter(loaded => loaded).length === Object.values(clientLoadedIds).length) {
							clearInterval(intervalId);
							resolve(curScript);
						} else if ((++i) === 500) {
							resolve(false);
						}
					}, 10);
				});
			} else {
				resolve(false);
			}
		})
	});
})();
