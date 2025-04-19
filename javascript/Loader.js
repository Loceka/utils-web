/**
 * Script loader
 * 
 * Start the script with :
 *   [varName].launchScript().then(process);
 * or
 *   await [varName].launchScript();
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
 */
const _jsUtilsLoader = ((varName = document?.currentScript?.dataset?.var, loadScripts = document?.currentScript?.dataset?.load) => {
	Object.prototype.atPath = function(path, defVal) { return String(path ?? "").split(/(?<!\\)\./).reduce((o, p) => o?.[p.replace(/\\\./g, ".")], this) ?? defVal; };
	Object.prototype.setAtPath = function(path, value) { return String(path ?? "").split(/(?<!\\)\./).reduce((o, p, i, a) => (p = p.replace(/\\\./g, "."), (o[p] = (i === a.length - 1) ? value : o[p] ?? {}), o[p]), this); };

	const unsetVarName = varName === undefined || varName === null;
	const curScript = unsetVarName ? this : (varName ? (typeof varName === "object" ? varName : this.atPath(varName, {})) : {});
	if (varName && (typeof varName === "string")) this.setAtPath(varName, curScript);

	const subScripts = [
		"0.type_assign.js",
		"1.DOM.js",
		"2.events.js",
		"3.net.js",
		"4.order_filter.js",
		"5.b64img.js",
		"6.CSS.js",
	];
	subScripts.byId = {};
	subScripts.forEach(scriptName => subScripts.byId[getScriptId(scriptName)] = scriptName);

	const scripts = {}, clientLoadedIds = {}, curDir = document.currentScript?.src?.replace(/[^\/]+$/, "");
	let dependencies = {}, startCB = [], loadCB = [];

	const scriptLoaded = new Promise(resolve => {
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
	});

	const waitForHtml = new Promise(resolve => {
		if (document?.body) {
			resolve();
		} else if (document?.addEventListener) {
			document.addEventListener('DOMContentLoaded', resolve, {capture:true, once:true, passive:true});
		} else if (window?.addEventListener) {
			window.addEventListener('load', resolve, {capture:true, once:true, passive:true});
		}
	});

	function addScript(script) {
		scripts[script.id] = script;
		if (!varName && !unsetVarName) Object.assign(curScript, script.code);
		dependencies[script.id]?.forEach(cb => cb(script.code));
		delete dependencies[script.id];
		clientLoadedIds[script.id] = true;
	}

	function clientLoadScript(scriptNameOrId) {
		const scriptId = getScriptId(String(scriptNameOrId));
		if (loadScripts && !(scriptId in clientLoadedIds)) { // do not execute if there are no client loaded scripts
			const scriptElem = document.createElement("script");
			scriptElem.setAttribute("type", "text/javascript");
			scriptElem.setAttribute("src", curDir + (subScripts?.byId[scriptId] ?? scriptNameOrId));
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
		Script: Script,
		scriptLoaded: scriptLoaded,
		launchScript() {
			startCB.forEach(cb => cb());
			startCB = undefined;
			return waitForHtml.then(() => scriptLoaded.then(() => {
				loadCB.forEach(cb => cb());
				loadCB = undefined;
			}));
		},
	});
})();
