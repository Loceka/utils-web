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
 *     <script type="text/javascript" data-var="util" src="2.events.js"></script>
 */
((cat, id, varName = document?.currentScript?.dataset?.var, autoVersion, Script) => {
	const curScript = (varName === undefined || varName === null) ? this : (varName ? (typeof varName === "object" ? varName : this[varName]??{}) : {});
	if (varName && (typeof varName === "string")) this[varName] = curScript;

	Script = Script || ((typeof _jsUtilsLoader === "undefined" || !_jsUtilsLoader) ? curScript?._jsUtilsLoader : _jsUtilsLoader)?.Script;
	const _ = Script ? new Script(id, autoVersion) : {
		setLaunchDependencies(deps) { Object.keys(deps).forEach(k => { this[k] = Object.assign(curScript, window[k] ?? (curScript !== window) ? window : {} ); }); },
		content(content) { return content; }
	};
	_.setLaunchDependencies({
		"u": 0
	});

	EventTarget.prototype._addEventListener = EventTarget.prototype.addEventListener;
	EventTarget.prototype._getEventListeners = function(type) {
		if (! this.eventListenerMap) this.eventListenerMap = {};
		if (type)  {
			return this.eventListenerMap[type] ?? (this.eventListenerMap[type] = []);
		} else {
			return this.eventListenerMap;
		}
	};
	EventTarget.prototype.addEventListener = function(type, handler, optOrCapture = false) {
		this._addEventListener(type, handler, optOrCapture);
		this._getEventListeners(type).push({handler:handler, options:optOrCapture});
	};
	EventTarget.prototype._removeEventListener = EventTarget.prototype.removeEventListener;
	// Redefine removeEventListener to allow removing all the listeners of a given type on an element
	EventTarget.prototype.removeEventListener = function(type, handler, optOrCapture) {
		const optDefined = (optOrCapture !== null) && (optOrCapture !== undefined);
		if (handler && optDefined) this._removeEventListener(type, handler, optOrCapture);

		for (let i = this._getEventListeners(type).length-1, listener; listener = this._getEventListeners(type)[i]; i--) {
			const matchOpts = !optDefined || (optOrCapture === listener.options) || (optOrCapture === listener.options.capture) || (optOrCapture.capture === listener.options) || (optOrCapture.capture === listener.options.capture);
			if (matchOpts && (!handler || listener.handler === handler)) {
				if (!handler || !optDefined) this._removeEventListener(type, listener.handler, listener.options);
				this.eventListenerMap[type].splice(i, 1);
			}
		}
		if (this.eventListenerMap[type].length === 0) delete this.eventListenerMap[type];
	};

	let optSupported;
	return Object.assign(curScript, _.content({
		toggleEvent(add, el, type, handler, opt = false){
			if (optSupported === undefined) {
				optSupported = false;
				let passive = Object.defineProperty({}, "passive", { get: function() { optSupported = true; } });
				try {
					window.addEventListener("test", parseInt, passive);
					window.removeEventListener("test", parseInt, passive);
				} catch(err) {}
			}
			let handlerType = _.u.typeOf(handler);
			if ((handlerType.object || handlerType.boolean) && _.u.typeOf(opt).function) {
				[handler, opt] = [opt, handler];
			}
			el[add ? "addEventListener" : "removeEventListener"](type, handler, optSupported ? opt : (typeof opt === "boolean") ? opt : opt.capture);
			return handler;
		},
		addEvent(el, type, handler, opt) {
			return this.toggleEvent(true, el, type, handler, opt);
		},
		removeEvent(el, type, handler, opt) {
			return this.toggleEvent(false, el, type, handler, opt);
		},
		fireEvent(el, evType, evClass = "Event", opt = {}) {
			let evClassType = _.u.typeOf(evClass);
			if (!evClassType.string) {
				opt = evClassType.object ? evClass : opt;
				evClass = evClassType.function ? evClass.name : "Event";
			}
			let evObj = new window[evClass](evType, {"bubbles":(opt.bubbles !== false), "cancelable":(opt.cancelable === true)});
			delete opt.bubbles;
			delete opt.cancelable;
			Object.assign(evObj, opt);
			el.dispatchEvent(evObj);
		},
		listEventListeners(elems, types) {
			const elemType = _.u.typeOf(elems);
			const selection = elemType.string ? [...document.querySelectorAll(elems)] : (elemType.array ? elems : (elemType.object ? [elems] : [...document.querySelectorAll('*'), document, window]));
			types = _.u.typeOf(types).array ? types : (types ? [types] : undefined);
			const windowTypes = (types || Object.keys(window)).filter(k => /^on[a-z]+$/.test(k));

			let listeners = [];
			for (const elem of selection) {
				// Events defined in attributes
				for (const type of windowTypes) {
					if (typeof elem[type] === 'function') {
						listeners.push({
							"node": elem,
							"type": type,
							"func": elem[type],
							"f": elem[type].toString()
						});
					}
				}

				// Events defined with addEventListener
				if (typeof elem._getEventListeners === 'function') {
					const evts = types ? Object.fromEntries(types.map(t => [t, elem._getEventListeners(t)]).filter(([,a]) => a.length)) : elem._getEventListeners();
					for (const type of Object.keys(evts)) {
						for (const listener of evts[type]) {
							listeners.push({
								"node": elem,
								"type": type,
								"func": listener.handler,
								"opts": listener.options,
								"f": listener.handler.toString()
							});
						}
					}
				}
			}

			return listeners.sort();
		}
	}));
})();
