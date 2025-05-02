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

	//
	// Read Parameters
	//
	const globalSettings = { useReturnValue: false, arrayResult: false, fromHashChanged: true, fromHash: true, fromQuery: true, fromStorage: true, saveStorage: false, priority: ["fromHashChanged", "fromHash", "fromQuery", "fromStorage"] };
	Object.setPrototypeOf(globalSettings, {
		sources: {},
		sourceAllowed(sourceName) { return this[sourceName]; },
		addSource({before = "*", after, sourceName, valueGetter, eventName, eventTarget} = {}) {
			const registerEvent = eventName ? () => eventTarget.addEventListener(eventName, readParams.retrieveValues.bind(readParams, sourceName)) : undefined;
			const getter = (param, context, eventSourceName, event) => (!eventName || (eventSourceName === sourceName)) && readParams.valueOf(param, valueGetter(param, context, event));

			this.sources[sourceName] = { source: sourceName, getter };

			if (before || after) {
				let index = this.priority.indexOf(after ?? before);
				index = (index === -1) ? (after ? this.priority.length : 0 ) : index + (after ? 1 : 0);
				this.priority.splice(index, 0, sourceName);
				this[sourceName] = true;

				registerEvent?.();
			} else if (before === null) {
				// should only be used by default sources : delay the event registering and don't add them to the priority list and allowed sources
				this.sources[sourceName].registerEvent = registerEvent;
			}
		},
	});

	Object.entries({
		fromStorage: {g: (param, c) => c.storage?.getItem(readParams.storageKey(param)) },
		fromQuery: {g: (param, c) => c.query?.get(param) },
		fromHash: {g: (param, c) => c.hash?.get(param) },
		fromHashChanged: {g: (param, c) => settings.fromHash && c.hash?.get(param), ev: "hashchange", el: window},
	}).forEach(([sourceName, {g:valueGetter, ev:eventName, el:eventTarget}]) => globalSettings.addSource({before: null, sourceName, valueGetter, eventName, eventTarget}));

	readParams = {
		firstCall: true,
		params: {},
		callbacks: {},
		actions: {},
		getSettings(params) {
			return curScript.typeOf(params).smartSwitch({
				unset: globalSettings,
				string: () => (this.params[params] ?? this.addParam(params)).settings,
				array: () => Object.fromEntries(this.params.map(param => [param, param ? (this.params[param] ?? this.addParam(params)).settings : globalSettings])),
			});
		},
		valueOf(param, value) {
			return (!this.params[param].settings.possibleValues || this.params[param].settings.possibleValues.includes(value)) && value;
		},
		storageKey(param) { return ((this.params[param].settings.storagePrefix ?? "") + ".").replace(/(?<=^|\.)\.$/, "") + param; },
		addParam(param, settings = {}, callback) {
			let p = this.params[param];
			const previousCbId = p?.cbId;
			let cbId = Object.keys(this.callbacks).find(k => this.callbacks[k].func === callback);

			if ((callback !== undefined) && previousCbId && previousCbId !== cbId) {
				// remove old associated callback
				this.removeParam(param, previousCbId);
			}

			if (!cbId && callback) {
				// new callback
				cbId = String(Math.max(0, ...Object.keys(this.callbacks)) + 1);
				this.callbacks[cbId] = {func: callback, paramList: [param]};
			} else if (cbId && (previousCbId !== cbId)) {
				// add current parameter to the existing callback param list
				this.callbacks[cbId].paramList.push(param);
			}

			if (p) {
				Object.assign(p.settings, settings);
				p.cbId = cbId;
			} else {
				Object.setPrototypeOf(settings, globalSettings);
				Object.assign(settings, globalSettings, settings);
				p = this.params[param] = {settings, cbId};
			}
			return p;
		},
		removeParam(param, onlyCbId) {
			const cbId = onlyCbId ?? this.params[param].cbId;
			const cbParams = this.callbacks[cbId]?.paramList;
			cbParams?.splice(cbParams.indexOf(param), 1);
			if (cbParams?.length === 0) {
				delete this.callbacks[cbId];
			}
			if (!onlyCbId) {
				delete this.params[param];
			}
		},
		storeCallback(param, values, oldValues, cbId, useReturnValue, fromEvent) {
			const keys = fromEvent ? [cbId] : (useReturnValue ? ["result"] : ["result", cbId]);
			for (const key of keys) {
				if (key) {
					const entry = this.actions[key] = this.actions[key] ?? ({ values: {}, oldValues: {}, changedParams: [] });
					entry.values[param] = values;
					entry.oldValues[param] = oldValues;
					entry.changedParams.push(param);
				}
			}
		},
		fireCallbacks(inputParams) {
			let result;
			Object.entries(this.actions).forEach(([cbId, {values, oldValues, changedParams}]) => {
				const cbInfo = cbId === "result" ? ({func: (...args) => result = args, paramList: inputParams}) : this.callbacks[cbId];
				let args = [values, oldValues, changedParams];
				if ((cbInfo.paramList?.length === 1) && (changedParams.length === 1)) {
					// if there is only 1 parameter associated with this callback, directly use the values
					args[0] = values[changedParams[0]];
					args[1] = oldValues[changedParams[0]];
				}
				cbInfo.func(...args);
			});

			this.actions = {};
			return result;
		},
		paramValue(param, context, eventSourceName, event) {
			const p = {values:oldValues, settings, cbId} = this.params[param];
			if (oldValues) {
				oldValues.fromHashChanged = oldValues.fromHashChanged === undefined ? oldValues.fromHash : oldValues.fromHashChanged;
			}
			const v = settings.priority.reduce((o, source) => (o[source] = oldValues?.[source], o), {});

			Object.values(settings.sources).filter(({source}) => settings[source]).forEach(({source, getter}) => {
				v[source] = getter(param, context, eventSourceName, event);
			});

			let modified = !curScript.equal(oldValues, v);
			if (!event || modified) {
				if (modified) p.values = v;

				const [cur, old] = [v, oldValues]
					.map(array => settings.priority.map(source => array?.[source]).filter((value, i, a) => value && (a.indexOf(value) === i))) // return unique defined values
					.map(array => settings.arrayResult ? array : array?.[0]); // return an array or a single value depending on the arrayResult setting

				const singleValue = Array.isArray(cur) ? cur[0] : cur;
				if (settings.saveStorage && singleValue) {
					window.localStorage?.setItem(this.storageKey(param), singleValue);
				}

				modified = !curScript.equal(cur, old);
				if (!event || modified) {
					this.storeCallback(param, cur, old, (modified ? cbId : undefined), settings.useReturnValue, event instanceof Event);
				}
			}
		},
		retrieveValues(eventOrInputParams, event) {
			const [eventSourceName, inputParams] = Array.isArray(eventOrInputParams) ? [,eventOrInputParams] : [eventOrInputParams];
			const storage = window.localStorage;
			const query = new URLSearchParams(window.location.search);
			const hash = new URLSearchParams(window.location.hash.substring(1));
			(inputParams ?? Object.keys(this.params)).forEach(param => this.paramValue(param, {storage, query, hash}, eventSourceName, event));

			return this.fireCallbacks(inputParams);
		},
		init({ params, removeParams, callback = globalSettings.callback, ...settings } = {}) {
			// Read arguments
			const args = [...arguments];
			params = curScript.typeOf(params).string ? [params] : params;
			removeParams = curScript.typeOf(removeParams).string ? [removeParams] : removeParams;
			if (!curScript.typeOf(args[0]).object || args.length > 1) {
				settings = {}; // "...settings" captures string and arrays
				let customCB = callback === globalSettings.callback ? undefined : callback, customParams = [], error = false;
				args.forEach((arg, i) => {
					curScript.typeOf(arg).smartSwitch({
						function: (v) => { error |= customCB !== undefined; customCB = v; },
						string: (v) => customParams.push(v),
						array: (v) => { error |= (customParams.length > 0 || v.some(o => !curScript.typeOf(o).string)); customParams = v; },
						object: () => error |= i !== 0,
						unset: undefined,
						default: () => error |= true,
					});
				});

				if (error) {
					console.error("[readParameters.init] invalid arguments");
					return;
				} else {
					params = params ? params.concat(customParams) : customParams;
					callback = customCB ?? globalSettings.callback;
				}
			}

			// settings.associatedParams = "(" + params.join(",") + ")"; // add "name" for debug purposes
			if ((!params || params.length === 0) && (!removeParams || removeParams.length === 0)) {
				// save default settings
				Object.assign(globalSettings, settings, {callback});
			}

			// remove parameters
			removeParams?.forEach(this.removeParam);

			if (this.firstCall) {
				this.firstCall = false;
				Object.values(globalSettings.sources).forEach(source => source.registerEvent?.());
			}

			if (params) {
				params.forEach(param => this.addParam(param, settings, callback));
				return this.retrieveValues(params);
			}
		},
	};

	//
	// TypeOf
	//
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
			type.anyNumber = objToString === "[object Number]";
			type.number = type.anyNumber && !isNaN(v);
			type.NaN = type.anyNumber && isNaN(v);
			type.string = objToString === "[object String]";
			type.anyObject = !type.unset && typeof v === "object";
			type.array = !type.unset && Array.isArray(v);
			type.collection = type.array || (!type.unset && !type.string && (typeof v.length === "number") && Array.from(v, (c, i) => c || v.hasOwnProperty(i)).every(a => a));
			type.function = typeof v === "function";
			type.object = type.anyObject && !type.boolean && !type.anyNumber && !type.string && !type.array && !type.function;
			type.empty = type.unset || v === "" || (type.anyObject && (v.length === 0 || Object.keys(v).length === 0)); // use getOwnPropertyNames instead of keys?
			type.filled = !type.empty;

			const allowedTypes = ["unset", "boolean", "number", "NaN", "string", "array", "function", "object"];
			type.type = Object.entries(type).find(([typeName, ofType]) => ofType && allowedTypes.includes(typeName))[0];
			type.emptyOrType = type.empty ? "empty" : type.type;

			return Object.freeze(Object.setPrototypeOf(type, typeOfPrototype));
		},
		equal(o1, o2) {
			let same = o1 === o2;
			if(!same) {
				const t1 = this.typeOf(o1), t2 = this.typeOf(o2);
				if (t1.type === t2.type) {
					same = t1.smartSwitch({
						NaN: true,
						boolean: () => o1?.valueOf() === o2?.valueOf(),
						number: () => o1?.valueOf() === o2?.valueOf(),
						string: () => o1?.valueOf() === o2?.valueOf(),
						anyObject: () => (Object.keys(o1).length === Object.keys(o2).length) && Object.entries(o1).every(([k, v]) => this.equal(v, o2[k])),
						default: false
					});
				}
			}
			return same ?? false;
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
		},
		/*
		 * Read parameters from URL query, URL hash and browser LocalStorage. URL hash parameters can also be listened to.
		 *
		 * This function is mainly called with 1 object argument :
		 * - object settings = {
		 *     params          : (default: unset) the parameters to read. Can be either a String or an array of Strings
		 *     removeParams    : (default: unset) the parameters to remove. Can be either a String or an array of Strings
		 *     callback        : (default: unset) a function to callback when the specified [params] change
		 *     useReturnValue  : (default: false) when calling this function directly, use the return value instead of the callback function.
		 *     arrayResult     : (default: false) the callback function (or return value) will be called with the list of values found in the different sources (hash, query, storage) ordered by priority, instead of just the first one
		 *     fromHashChanged : (default: true) listen for [params] in URL#hash values when the URL hash changes (without reloading the page)
		 *     fromHash        : (default: true) search for [params] in URL#hash values. Setting it to [false] will also prevent fromHashChanged to be triggered
		 *     fromQuery       : (default: true) search for [params] in URL?query values
		 *     fromStorage     : (default: true) search for [params] in localStorage values (using [storagePrefix].[param] as key)
		 *     saveStorage     : (default: false) save the theme in localStorage (using [storagePrefix].[param] as key)
		 *     storagePrefix   : (default: unset) add a prefix to [param] in localStorage for search and save purposes
		 *     priority        : (default: ["fromHash", "fromQuery", "fromStorage"]) the priority of the sources : the first source found is used.
		 *     possibleValues  : (default: unset) a list of possible values for all declared [params]
		 * }
		 *
		 * The callback function is called (when the associated parameters values change) with 3 arguments :
		 *   - currentValue (or list of values if arrayResult is [true])
		 *   - oldValue (or list of values if arrayResult is [true])
		 *   - the list of parameters that changed
		 * If several parameters are associated with the same callback function, the first 2 arguments are an associative object instead : { parameter : currentValue(s) }, { parameter : oldValue(s) }
		 *
		 * When the function is called without either [params] or [removeParams] arguments, the input settings override the default settings values.
		 * Otherwise, the input settings are associated with the specified [params].
		 *
		 * This function can also be called with:
		 *   - a function, that will be considered as the callback function (only 1 function argument is allowed)
		 *   - an array of String or multiple String values, that will be considered as [params]
		 *   - the settings object as first parameter in addition to the previous arguments, that will be used according to the above decription
		 */
		readParameters: readParams.init.bind(readParams),
		/*
		 * Use readParametersSettings().addSource(...) to add a new source associated with the parameter
		 */
		readParametersSettings: readParams.getSettings.bind(readParams),
	}));
})();
