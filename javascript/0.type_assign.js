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
 *     <script type="text/javascript" data-var="util" src="0.type_assign.js"></script>
 */
((cat, id, varName = document?.currentScript?.dataset?.var, autoVersion, Script) => {
	const curScript = (varName === undefined || varName === null) ? this : (varName ? (typeof varName === "object" ? varName : this[varName]??{}) : {});
	if (varName && (typeof varName === "string")) this[varName] = curScript;

	Script = Script || ((typeof _jsUtilsLoader === "undefined" || !_jsUtilsLoader) ? curScript?._jsUtilsLoader : _jsUtilsLoader)?.Script;
	const _ = Script ? new Script(id, autoVersion) : {
		setLaunchDependencies(deps) { Object.keys(deps).forEach(k => { this[k] = Object.assign(curScript, window[k] ?? (curScript !== window) ? window : {} ); }); },
		content(content) { return content; }
	};

	const typeOfPrototype = {
		apply(callback) { return callback(this, this.v); },
		switch(options) { const opts = (typeof options === "function") ? options(this.v, this) : options; return Object.entries(opts).find(([k]) => this[k])?.[1]; },
		applySwitch(options) { return this.switch(options)?.(this.v, this); },
		smartSwitch(options) { const result = this.switch(options); return (typeof result === "function") ? result(this.v, this) : result; },
		default: true, // for switch purpose
	};

	return Object.assign(curScript, _.content({
		typeOf(v) {
			const objToString = Object.prototype.toString.call(v);
			const type = { v:v, null: v === null, undefined: v === undefined };
			type.unset = type.null || type.undefined;
			type.set = !type.unset;
			type.boolean = objToString === "[object Boolean]";
			type.number = objToString === "[object Number]";
			type.string = objToString === "[object String]";
			type.anyObject = !type.unset && typeof v === "object";
			type.array = !type.unset && Array.isArray(v);
			type.collection = type.array || (!type.unset && !type.string && (typeof v.length === "number") && Array.from(v, (c, i) => c || v.hasOwnProperty(i)).every(a => a));
			type.function = typeof v === "function";
			type.object = type.anyObject && !type.boolean && !type.number && !type.string && !type.array && !type.function;
			type.empty = type.unset || v === "" || (type.anyObject && (v.length === 0 || Object.keys(v).length === 0)); // use getOwnPropertyNames instead of keys?
			type.filled = !type.empty;

			const allowedTypes = ["unset", "boolean", "number", "string", "array", "function", "object"];
			type.type = Object.entries(type).find(([typeName, ofType]) => ofType && allowedTypes.includes(typeName))[0];
			type.emptyOrType = type.empty ? "empty" : type.type;

			return Object.freeze(Object.setPrototypeOf(type, typeOfPrototype));
		},
		partial(fn, thisObj) {
			const curriedArgs = Array.prototype.slice.call(arguments, 2);
			const curriedArgsCount = curriedArgs.length;
			return function() {
				const args = Array.prototype.slice.call(arguments);
				for (let i = 0; i < curriedArgsCount || args.length; i++) {
					if (i >= curriedArgsCount || curriedArgs[i] === Symbol.for("skip")) {
						curriedArgs[i] = args.shift();
					}
				}
				return fn.apply(thisObj, curriedArgs);
			}
		}
	}));
})();
