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
			type.boolean = objToString === "[object Boolean]";
			type.number = objToString === "[object Number]";
			type.string = objToString === "[object String]";
			type.anyObject = !type.unset && typeof v === "object";
			type.array = !type.unset && Array.isArray(v);
			type.collection = type.array || (!type.unset && !type.string && (typeof v.length === "number") && Array.from(v, (c, i) => c || v.hasOwnProperty(i)).every(a => a));
			type.function = typeof v === "function";
			type.object = type.anyObject && !type.boolean && !type.number && !type.string && !type.array && !type.function;
			type.empty = type.unset || v === "" || (type.anyObject && (v.length === 0 || Object.keys(v).length === 0)); // use getOwnPropertyNames instead of keys?

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