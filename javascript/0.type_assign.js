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
	const globalSettings = Object.assign(
		Object.create({
			additionalNotSourceKeys: ["value", "forcedValue"],
			callbackSettings: ["mapResult", "resultBySource"],
			get mapResult() { return readParams.callbacks[this.cbId].cbSettings.mapResult; },
			set mapResult(v) { if (v === null) { delete readParams.callbacks[this.cbId].cbSettings.mapResult } else { readParams.callbacks[this.cbId].cbSettings.mapResult = v; } },
			get resultBySource() { return readParams.callbacks[this.cbId].cbSettings.resultBySource; },
			set resultBySource(v) { if (v === null) { delete readParams.callbacks[this.cbId].cbSettings.resultBySource } else { readParams.callbacks[this.cbId].cbSettings.resultBySource = v; } },
			sources: {},
			eventSources: [],
			addSource({before = "*", after, sourceName, valueGetter, eventName, eventTarget} = {}) {
				if (this.additionalNotSourceKeys.includes(sourceName)) {
					throw new Error(sourceName + " is a reserved keyword and cannot be used as source name.");
				} else if (sourceName in this.sources) {
					throw new Error("The source " + sourceName + " already exists.");
				}
				const registerEvent = eventName ? () => eventTarget.addEventListener(eventName, readParams.retrieveValues.bind(readParams, sourceName)) : undefined;
				const getter = (param, context, eventSourceName, event) => (!eventName || (eventSourceName === sourceName)) && valueGetter(param, context, event);

				this.sources[sourceName] = { source: sourceName, getter };

				if (eventName) {
					this.eventSources.push(sourceName);
				} else if (before || after) {
					let index = this.priority.indexOf(after ?? before);
					index = (index === -1) ? (after ? this.priority.length : 0 ) : index + (after ? 1 : 0);
					this.priority.splice(index, 0, sourceName);
				}

				if (before === null) {
					// should only be used by default sources : delay the event registering and don't add them to the priority list and allowed sources
					this.sources[sourceName].registerEvent = registerEvent;
				} else {
					this.from[sourceName] = this.from[sourceName] ?? true;
					registerEvent?.();
				}
			},
			notifySourceValueChanged(source, context = readParams.getContext(), event) {
				Object.entries(readParams.params).forEach(([param, {sourceValueMap, settings}]) => {
					context.settings = settings;
					if (sourceValueMap && settings?.[source]) {
						sourceValueMap.modifiedValue(source, readParams.valueOf(param, settings.sources[source].getter(param, context, (event && source), event)), undefined, true);
					}
				});
			},
		}),
		{ cbId: "-1", useReturnValue: false, from: {hashChanged: true, hash: true, query: true, storage: undefined}, storagePrefix: undefined, saveStorage: undefined, priority: ["hash", "query", "storage"] }
	);

	Object.entries({
		storage: {g: (param, c) => c.storage?.getItem(readParams.storageKey(param)) },
		query: {g: (param, c) => c.query?.get(param) },
		hash: {g: (param, c) => c.hash?.get(param) },
		hashChanged: {g: (param, c) => c.settings.from.hash && c.hash?.get(param), ev: "hashchange", el: window},
	}).forEach(([sourceName, {g:valueGetter, ev:eventName, el:eventTarget}]) => globalSettings.addSource({before: null, sourceName, valueGetter, eventName, eventTarget}));

	readParams = {
		firstCall: true,
		params: {},
		defaultCbId: globalSettings.cbId,
		callbacks: {[globalSettings.cbId]: {func:undefined, cbSettings: {}, paramList: []}},
		getSpecificCallbackId(callback) { return Object.keys(this.callbacks).find(k => (k !== this.defaultCbId) && this.callbacks[k].func === callback); },
		actions: {},
		getSettings(...params) {
			params = params.includes("*") ? ["", ...Object.keys(this.params)] : params.length > 1 ? params : params[0];
			return curScript.typeOf(params).smartSwitch({
				empty: globalSettings,
				string: (s) => ["globalSettings", "defaultSettings"].includes(s) ? globalSettings : (this.params[s] ?? this.addParam(s)).settings,
				array: () => Object.fromEntries(params.map(param => [param, this.getSettings(param)])),
			});
		},
		valueOf(param, value, ensureDifferent, differsFromValue) {
			if (ensureDifferent && value === differsFromValue) {
				return false;
			}
			return (!this.params[param].settings.possibleValues || this.params[param].settings.possibleValues.includes(value)) && value || undefined;
		},
		storageKey(param) { return ((this.params[param].settings.storagePrefix ?? "") + ".").replace(/(?<=^|\.)\.$/, "") + param; },
		addParam(param, settings = {}, callback) {
			let p = this.params[param];
			const previousCbId = p?.settings.cbId;
			let cbId = this.getSpecificCallbackId(callback);

			if ((callback !== undefined) && previousCbId && previousCbId !== cbId) {
				// remove old associated callback
				this.removeParam(param, previousCbId);
			}

			if ((callback === null && !this.callbacks[cbId]?.paramList?.includes(param)) || (!cbId && callback)) {
				// new callback
				cbId = String(Math.max(0, ...Object.keys(this.callbacks)) + 1);
				this.callbacks[cbId] = {func: callback, cbSettings: Object.create(this.callbacks[this.defaultCbId].cbSettings), paramList: [param]};
			} else if (cbId && (previousCbId !== cbId)) {
				// add current parameter to the existing callback param list
				this.callbacks[cbId].paramList.push(param);
			}

			const modifiedStoragePrefix = settings.storagePrefix;
			cbId = (callback === undefined) ? (previousCbId ?? this.defaultCbId) : cbId;
			if (p) {
				Object.assign(p.settings, {cbId}, settings);
			} else {
				p = this.params[param] = {settings: Object.assign(Object.create(globalSettings), {cbId, from: Object.create(globalSettings.from)}, settings)};
			}

			if (p.settings.from === null) {
				p.settings.from = Object.create(globalSettings.from);
			}
			if (p.settings.priority === null) {
				delete p.settings.priority;
			}
			if (modifiedStoragePrefix !== undefined) {
				p.settings.from.storage = p.settings.from.storage ?? true;
				p.settings.saveStorage = p.settings.saveStorage ?? true
			}

			return p;
		},
		removeParam(param, onlyCbId) {
			const cbId = onlyCbId ?? this.params[param].settings.cbId;
			if (cbId && (cbId !== this.defaultCbId)) {
				const cbParams = this.callbacks[cbId]?.paramList;
				cbParams?.splice(cbParams.indexOf(param), 1);
				if (cbParams?.length === 0) {
					delete this.callbacks[cbId];
				}
			}
			if (!onlyCbId) {
				delete this.params[param];
			}
		},
		storeCallback(param, values, oldValues, cbId, useReturnValue, mapResult, fromEvent) {
			const keys = fromEvent ? [cbId] : (useReturnValue ? ["result"] : ["result", cbId]);
			for (const key of keys) {
				if (key) {
					const entry = this.actions[key] = this.actions[key] ?? ({ values: {}, oldValues: {}, changedParams: [] });
					entry.values[param] = values;
					entry.oldValues[param] = oldValues;
					entry.changedParams.push(param);
					entry.mapResult = mapResult;
				}
			}
		},
		fireCallbacks(inputParams) {
			let result;
			Object.entries(this.actions).forEach(([cbId, {values, oldValues, changedParams, mapResult}]) => {
				const cbInfo = cbId === "result" ? ({func: (...args) => result = args, paramList: inputParams}) : this.callbacks[cbId];
				let args = [values, oldValues, changedParams];
				if (mapResult !== true && (mapResult === false || cbInfo.paramList?.length === 1) && (changedParams.length === 1)) {
					// if there is only 1 parameter associated with this callback, directly use the values
					args[0] = values[changedParams[0]];
					args[1] = oldValues[changedParams[0]];
				}
				cbInfo.func?.(...args);
			});

			this.actions = {};
			return result;
		},
		valueMapPrototype: {
			from(oldValuesMap, settings, eventSourceName, event) {
				const o = this === readParams.valueMapPrototype ? Object.create(this) : this;
				const filteredEvents = settings.eventSources.filter(source => settings.from[source]);
				const filteredPriorities = settings.priority.filter(source => settings.from[source]);
				const filteredEvent = event && settings.from[eventSourceName] ? [eventSourceName] : [];
				const priorityChanged = settings.oldPriority && !curScript.equal(filteredPriorities, settings.oldPriority);
				settings.oldPriority = filteredPriorities;
				globalSettings.additionalNotSourceKeys.concat(filteredEvents).concat(filteredPriorities).forEach(source => o[source] = structuredClone(oldValuesMap?.[source]));
				return {valuesMap: o, oldValue: oldValuesMap?.value, filteredPriorities: filteredEvent.concat(filteredPriorities), priorityChanged};
			},
			modifiedValue(source, newValue, modifiedSources, notified) {
				let sourceInfo = this[source], modified;
				if (newValue !== sourceInfo?.value) {
					modified = true;
					sourceInfo = sourceInfo ?? (this[source] = {});;
					sourceInfo.value = newValue;
					sourceInfo.lastModified = Date.now();
					sourceInfo.notified = notified;
				} else if (sourceInfo?.notified && !notified) {
					modified = true;
					sourceInfo.notified = notified;
				}
				return modified && (this.value !== sourceInfo.value) && (modifiedSources?.push(source), sourceInfo.value);
			},
		},
		paramValue(param, context, eventSourceName, event, forcedValue) {
			const p = {sourceValueMap:oldValuesMap, settings} = this.params[param];
			const {valuesMap: curValuesMap, oldValue, filteredPriorities, priorityChanged} = this.valueMapPrototype.from(oldValuesMap, settings, eventSourceName, event);

			curValuesMap.forcedValue = forcedValue;
			forcedValue = typeOf(forcedValue === false ? undefined : forcedValue = 0 ? "0" : forcedValue).empty ? forcedValue : this.valueOf(param, forcedValue, true, oldValue);
			let modifiedValue = forcedValue, modifiedSources = [], paramValue;
			if (forcedValue === undefined) {
				context.settings = settings;
				filteredPriorities.forEach(source => {
					const modV = curValuesMap.modifiedValue(source, this.valueOf(param, settings.sources[source].getter(param, context, eventSourceName, event)), modifiedSources);
					// retrieve the first modified value
					modifiedValue = modifiedValue || modV
					// retrieve the first not empty value (but may default to undefined) - if from.storage and saveStorage is activated, don't read the storage if the other sources are unset
					paramValue = paramValue || ((settings.saveStorage && source === "storage" && modifiedSources.length) ? paramValue : curValuesMap[source]?.value);
				});
			}

			// handle unsetting a value
			if (oldValuesMap) Object.entries(oldValuesMap).filter(([source, info]) => info?.value && !(source in curValuesMap)).forEach(([source]) => modifiedSources.push(source));
			modifiedValue = modifiedValue ? modifiedValue : (paramValue !== oldValue) && (priorityChanged || modifiedSources.length > 0 || modifiedValue === null) && paramValue;

			curValuesMap.value = modifiedValue === false ? curValuesMap.value : modifiedValue;
			let modifiedMap = !curScript.equal(curValuesMap, oldValuesMap);
			if (!event || modifiedMap) {
				if (modifiedMap) p.sourceValueMap = curValuesMap;

				if (!event || modifiedValue !== false) {
					const [curVal, oldVal] = settings.resultBySource ? [structuredClone(p.sourceValueMap), structuredClone(oldValuesMap)] : [p.sourceValueMap.value, oldValue];
					this.storeCallback(param, curVal, oldVal, (modifiedValue !== false ? settings.cbId : undefined), settings.useReturnValue, settings.mapResult, event instanceof Event);
				}

				if (settings.saveStorage) {
					if (p.sourceValueMap.value) {
						window.localStorage?.setItem(this.storageKey(param), p.sourceValueMap.value);
					} else {
						window.localStorage?.removeItem(this.storageKey(param));
					}
					if (settings.from.storage) {
						p.sourceValueMap.modifiedValue("storage", p.sourceValueMap.value ?? undefined);
					}
				}
			}
		},
		getContext() {
			const storage = window.localStorage;
			const query = new URLSearchParams(window.location.search);
			const hash = new URLSearchParams(window.location.hash.substring(1));
			return {storage, query, hash};
		},
		retrieveValues(eventOrInputParams, event, forcedValues) {
			const [eventSourceName, inputParams] = Array.isArray(eventOrInputParams) ? [,eventOrInputParams] : [eventOrInputParams];
			(inputParams ?? Object.keys(this.params)).forEach(param => this.paramValue(param, this.getContext(), eventSourceName, event, forcedValues?.[param]));

			return this.fireCallbacks(inputParams);
		},
		cyclePossibleValues(params = [], newPossibleValues, inputToggleValues) {
			const cycledValues = {};
			for (param of ((inputToggleValues && Object.keys(inputToggleValues)) ?? params)) {
				const inputValue = inputToggleValues?.[param];
				const inputValueType = curScript.typeOf(inputValue);
				if (!inputToggleValues || (inputValueType.boolean && inputValue)) {
					const {sourceValueMap: {value}, settings} = this.params[param] ?? {sourceValueMap: {}};
					const possibleValues = newPossibleValues ?? settings?.possibleValues, length = possibleValues?.length, i = possibleValues?.indexOf(value);
					cycledValues[param] = possibleValues?.[(length + i + 1) % length];
				} else if (inputValueType.unset || inputValueType.string || inputValueType.number) {
					cycledValues[param] = inputValue;
				} else if (!inputValueType.boolean) {
					console.error("[readParameters.init] invalid  toggle argument");
				}
			}
			return cycledValues;
		},
		init({ params, removeParams, renameParams, callback, toggle, ...settings } = {}) {
			// Read arguments
			const args = [...arguments];
			params = curScript.typeOf(params).string ? [params] : params;
			removeParams = curScript.typeOf(removeParams).string ? [removeParams] : removeParams;

			let error = false;
			const firstArgType = curScript.typeOf(args[0]);
			if (!firstArgType.object || args.length > 1) {
				// "...settings" captures string and arrays
				settings = firstArgType.string || firstArgType.array ? {} : settings;
				let customCB = callback, customParams = [];
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

				params = params ? params.concat(customParams) : customParams;
				callback = customCB;
			}
			const forcedValues = curScript.typeOf(toggle).smartSwitch({
				undefined: toggle,
				null: (v) => params.reduce((o, param) => (o[param] = v, o), {}),
				string: (v) => params.reduce((o, param) => (o[param] = v, o), {}),
				boolean: (v) => (v && this.cyclePossibleValues(params, settings.possibleValues)) ?? undefined,
				object: (v) => this.cyclePossibleValues(params, settings.possibleValues, v),
				default: () => error |= true,
			});
			const renameParamsType = curScript.typeOf(renameParams);
			renameParams = renameParamsType.smartSwitch({
				empty: {},
				boolean: {},
				string: (v) => {
					error |= (params.length !== 1);
					return params.reduce((o, param) => (o[v] = param, o), {});
				},
				object: renameParams,
				default: () => error |= true,
			});
			if (error) {
				console.error("[readParameters.init] invalid arguments");
				return;
			}

			// settings.associatedParams = "(" + params.join(",") + ")"; // add "name" for debug purposes
			if ((!params || params.length === 0) && (!removeParams || removeParams.length === 0) && renameParamsType.empty) {
				const cbId = this.getSpecificCallbackId(callback);
				if (cbId && (Object.keys(settings).length > 0) && Object.keys(settings).every(k => globalSettings.callbackSettings.includes(k))) {
					// save callback specific settings
					Object.assign(this.callbacks[cbId].cbSettings, settings);
				} else {
					// save default settings
					Object.assign(globalSettings, settings, { callback: callback === undefined ? globalSettings.callback : callback });
					this.callbacks[this.defaultCbId].func = globalSettings.callback;
				}
			}

			// remove parameters
			removeParams?.forEach(p => this.removeParam(p));

			// rename parameters
			Object.entries(renameParams ?? {}).forEach(([oldName, newName]) => {
				if (this.params.hasOwnProperty(oldName)) {
					if (this.params[newName]) {
						this.removeParam(oldName);
					} else {
						this.params[newName] = this.params[oldName];
						delete this.params[oldName];
						Object.values(this.callbacks).forEach(({paramList}) => {
							const index = paramList.indexOf(oldName);
							if (index != -1) {
								paramList.splice(index, 1, newName);
							}
						});
					}
				}
			});

			if (this.firstCall) {
				this.firstCall = false;
				Object.values(globalSettings.sources).forEach(source => source.registerEvent?.());
			}

			if (params) {
				params.forEach(param => this.addParam(param, settings, callback));
				return this.retrieveValues(params, undefined, forcedValues);
			}
		},
	};

	//
	// Inheritance
	//
	function listClasses(obj, list = [], last) {
		if (obj !== undefined && obj !== null) {
			const constr = obj.constructor.name;
			if (constr !== last) {
				list.push(constr);
			}
			return listClasses(Object.getPrototypeOf(obj), list, constr);
		}
		return list;
	}

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
			const type = Object.assign(Object.create(typeOfPrototype), { v:v, null: v === null, undefined: v === undefined });
			type.unset = type.null || type.undefined;
			type.set = !type.unset;
			type.boolean = objToString === "[object Boolean]";
			type.anyNumber = objToString === "[object Number]";
			type.number = type.anyNumber && !isNaN(v);
			type.NaN = type.anyNumber && isNaN(v);
			type.string = objToString === "[object String]";
			type.function = typeof v === "function";
			type.array = !type.unset && Array.isArray(v);
			type.collection = type.array || (!type.unset && !type.string && !type.function && (typeof v.length === "number") && Array.from(v, (c, i) => c || v.hasOwnProperty(i)).every(a => a));
			type.spreadableCollection = type.collection && (typeof v?.[Symbol.iterator] === "function");
			type.anyObject = !type.unset && typeof v === "object";
			type.object = type.anyObject && !type.boolean && !type.anyNumber && !type.string && !type.array && !type.function;
			type.empty = type.unset || v === "" || (type.anyObject && !type.boolean && !type.anyNumber && (v.length === 0 || Object.keys(v).length === 0)); // use getOwnPropertyNames instead of keys?
			type.filled = !type.empty;

			const allowedTypes = ["unset", "boolean", "number", "NaN", "string", "array", "function", "object"];
			type.type = Object.entries(type).find(([typeName, ofType]) => ofType && allowedTypes.includes(typeName))[0];
			if (type.anyObject) {
				listClasses(v).forEach((clazz, i) => { (i === 0 && type.type === "object") && (type.type = clazz); type[clazz] = true});
			}
			type.emptyOrType = type.empty ? "empty" : type.type;

			return Object.freeze(type);
		},
		listClasses,
		equal(o1, o2, unordered) {
			let same = o1 === o2 || (o1?.valueOf() !== undefined && o1?.valueOf() === o2?.valueOf());
			if(!same) {
				const t1 = this.typeOf(o1), t2 = this.typeOf(o2);
				if (t1.type === t2.type) {
					same = t1.smartSwitch({
						NaN: true,
						boolean: false,
						number: false,
						string: false,
						array: () => (o1.length === o2.length) && o1.every((v, i) => unordered ? o2.some(v2 => this.equal(v, v2)) : this.equal(v, o2[i])),
						collection: () => {
							const a2 = t2.collection ? Array.from(o2) : o2;
							return t2.collection && (o1.length === o2.length) && Array.from(o1).every((v, i) => unordered ? a2.some(v2 => this.equal(v, v2)) : this.equal(v, o2[i]));
						},
						anyObject: () => (o1.toString?.() === o2.toString?.()) && (Object.keys(o1).length === Object.keys(o2).length) && Object.entries(o1).every(([k, v]) => this.equal(v, o2[k])),
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
		 *     renameParams    : (default: unset) the parameters to rename. It must be an associative object : { oldName => newName }
		 *     callback        : (default: unset) the function to callback when the specified [params] change
		 *                                        if null, creates unique callback settings for each param, with no associated callback function. Do not default to the global callback (if set)
		 *     toggle          : (default: unset) forces the return/callback value to the [toggle] String value. If [possibleValues] is set, setting [toggle] to true will cycle between the values.
		 *     useReturnValue  : (default: false) when calling this function directly, use the return value instead of the callback function.
		 *     mapResult       : (default: unset) if true, the result/callback input will always be a map { param => value }
		 *                                        if false, the result/callback input will only be a map when several parameters are returned
		 *                                        if undefined, the result/callback input will be a map when supplied to a default callback, to a callback associated with several parameters or when several parameters are returned
		 *                                        if null, use the default (global) settings value. If this is the default settings, acts like undefined
		 *     resultBySource  : (default: false) the callback function (or return value) input will be the [source => value] mapping of the value read from each source (fromHash, fromQuery, fromStorage, ...),
		 *                                        otherwise, the input is the first modified value (without specifying the source)
		 *                                        if null, use the default (global) settings value. If this is the default settings, acts like false
		 *     from : {        : from { ... } allows enabling/disabling sources. New sources are automatically added to this object.
		 *         hashChanged : (default: true) listen for [params] in URL#hash values when the URL hash changes (without reloading the page)
		 *         hash        : (default: true) search for [params] in URL#hash values. Setting it to [false] will also prevent fromHashChanged to be triggered
		 *         query       : (default: true) search for [params] in URL?query values
		 *         storage     : (default: unset) search for [params] in localStorage values (using [storagePrefix].[param] as key)
		 *     }
		 *     storagePrefix   : (default: unset) add a prefix to [param] in localStorage for search and save purposes. Setting it also sets fromStorage and saveStorage to true, unless specified otherwise.
		 *     saveStorage     : (default: unset) save the theme in localStorage (using [storagePrefix].[param] as key)
		 *     priority        : (default: ["hash", "query", "storage"]) the priority of the sources : the first source found is used. The sources that are event triggered do not belong here
		 *     possibleValues  : (default: unset) a list of possible values for all declared [params]
		 * }
		 *
		 * The callback function is called (when the associated parameters values change) with 3 arguments :
		 *   - currentValue (or map of [source => value] if resultBySource is [true])
		 *   - oldValue (or map of [source => value] if resultBySource is [true])
		 *   - the list of parameters that changed
		 * If several parameters are associated with the same callback function, the first 2 arguments are an associative object instead : { parameter : currentValue(s) }, { parameter : oldValue(s) }
		 * Each param can only be associated with a unique callback. If the function is called several times with the same [params] but with different callbacks, the last one will prevail.
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
		 * Retrieve the settings associated with:
		 *   - The parameter or parameters if a unique String argument, several String arguments or an array of String are specified
		 *   - The global settings if no parameter is specified, or if the parameter is "globalSettings", "defaultSettings" or an empty string or array
		 *   - All the settings (global and parameters) if "*" is specified
		 *
		 * Each returned [setting] object allows accessing those functions :
		 *   - addSource({before, after, sourceName, valueGetter, eventName, eventTarget})
		 *      => adds a new source associated with the parameter and prioritizes it [before] or [after] another source
		 *      eg. readParametersSettings("user").addSource({
		 *              before: "fromHash",
		 *              sourceName: "fromHashChanged",
		 *              valueGetter: (param, context, event) => context.hash?.get(param),
		 *              eventName: "hashchange",
		 *              eventTarget: window
		 *          })
		 *
		 *   - notifySourceValueChanged(source, context, event)
		 *      => force updating the source value of the parameter by calling it's getter with the ([current param], context, event) arguments
		 */
		readParametersSettings: readParams.getSettings.bind(readParams),
	}));
})();
