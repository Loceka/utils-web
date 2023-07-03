// ^(function )(\w+)
// _.$2 = $1$2
function getType(v) {
	var type = {null: v === null, undefined: v === undefined};
	type.unset = type.null || type.undefined;
	type.boolean = typeof v === "boolean";
	type.number = typeof v === "number";
	type.string = typeof v === "string";
	type.anyObject = !type.unset && typeof v === "object";
	type.array = !type.unset && Array.isArray(v);
	type.collection = type.array || (!type.unset && (typeof v.length === "number") && Array.from(v, (c, i) => c || v.hasOwnProperty(i)).every(a => a));
	type.function = !type.unset && Object.prototype.toString.call(v) === "[object Function]";
	type.object = type.anyObject && !type.array && !type.function;
	type.empty = type.unset || v === "" || (type.anyObject && (v.length === 0 || Object.getOwnPropertyNames(v).length === 0));

	var typeStr = "";
	for (var k in type) {
		if (type[k] && ["null", "undefined", "empty", "anyObject", "collection"].indexOf(k) === -1) {
			typeStr = k;
			break;
		}
	}
	type.emptyOrType = type.empty ? "empty" : typeStr;
	type.type = typeStr;

	return Object.freeze(type);
}

//
// DOM
//
Node.prototype.querySelectorArray = function() {
	return Array.from(this.querySelectorAll.apply(this, Array.from(arguments)));
}

function getAncestorOrSelf(elem, nodeNames, classNames) {
	classNames = (classNames && typeof classNames === "object") ? (Array.isArray(classNames) ? classNames : Object.keys(classNames)) : [classNames ? classNames : ".*"];
	nodeNames = (nodeNames && typeof nodeNames === "object") ? (Array.isArray(nodeNames) ? nodeNames : Object.keys(nodeNames)) : [nodeNames ? nodeNames : ".*"];
	var classRE = new RegExp("\\b(?:" + classNames.join("|") + ")\\b"), nodeRE = new RegExp("^(?:" + nodeNames.join("|") + ")$", "i");
	while(elem && (!nodeRE.test(elem.nodeName || "") || !classRE.test(elem.className || "_"))) elem = elem.parentElement;
	return elem;
}

function getChildIndex(elem, startIndex = 0, elemOfType = "*") {
	elemOfType = (typeof elemOfType === "boolean") ? (elemOfType ? elem.nodeName || "*" : "*") : elemOfType;
	let childNodes = elem ? elem.parentElement.querySelectorAll(":scope>" + elemOfType) : [];
	for (let i = startIndex, child; child = childNodes[i-startIndex]; i++) {
		if (child === elem) {
			return i;
		}
	}
	return -1;
}

function getNodePath(elem, startPath) {
	let path = [], start = startPath ? document.querySelector(startPath) : document;
	if (elem && start) {
		for (let child = elem, parent; (child !== start) && (parent = child.parentElement); child = parent){
			path.push(">" + (child.nodeName||"*") + ":nth-of-type(" + getChildIndex(child, 1, true) + ")");
			if (!startPath && parent.id) {
				startPath = "#" + parent.id;
				start = parent;
			}
		}
		path.push(startPath || "html");
	} else {
		console.log("Erreur: getNodePath: aucun élément trouvé pour elem: '" + elem + "' ou startPath: '" + startPath + "'");
	}
	return start && path.reverse().join("");
}

//
// Events
//
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

function listEventListeners(elems, types) {
	const elemType = getType(elems);
	const selection = elemType.string ? document.querySelectorArray(elems) : (elemType.array ? elems : (elemType.object ? [elems] : [...document.querySelectorAll('*'), document, window]));
	types = getType(types).array ? types : (types ? [types] : undefined);
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

let optSupported;
function toggleEvent(add, el, type, handler, opt = false){
	if (optSupported === undefined) {
		optSupported = false;
		let passive = Object.defineProperty({}, "passive", { get: function() { optSupported = true; } });
		try {
			window.addEventListener("test", parseInt, passive);
			window.removeEventListener("test", parseInt, passive);
		} catch(err) {}
	}
	let handlerType = getType(handler);
	if ((handlerType.object || handlerType.boolean) && getType(opt).function) {
		[handler, opt] = [opt, handler];
	}
	el[add ? "addEventListener" : "removeEventListener"](type, handler, optSupported ? opt : (typeof opt === "boolean") ? opt : opt.capture);
	return handler;
}
function addEvent(el, type, handler, opt) {
	return toggleEvent(true, el, type, handler, opt);
}
function removeEvent(el, type, handler, opt) {
	return toggleEvent(false, el, type, handler, opt);
}

function fireEvent(el, evType, evClass = "Event", opt = {}) {
	let evClassType = getType(evClass);
	if (!evClassType.string) {
		opt = evClassType.object ? evClass : opt;
		evClass = evClassType.function ? evClass.name : "Event";
	}
	let evObj = new window[evClass](evType, {"bubbles":(opt.bubbles !== false), "cancelable":(opt.cancelable === true)});
	delete opt.bubbles;
	delete opt.cancelable;
	Object.assign(evObj, opt);
	el.dispatchEvent(evObj);
}

//
// Mouse and element positions
//
function getPosX(ev) { ev = ev||window.event; return ev.pageX ? ev.pageX : ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft; }
function getPosY(ev) { ev = ev||window.event; return ev.pageY ? ev.pageY : ev.clientY + document.body.scrollTop + document.documentElement.scrollTop; }
function getElemX(elem) {
	var elemX = elem.offsetLeft;
	while (elem = elem.offsetParent) {
		elemX += elem.offsetLeft;
	}
	return elemX;
}
function getElemY(elem) {
	var elemY = elem.offsetTop;
	while (elem = elem.offsetParent) {
		elemY += elem.offsetTop;
	}
	return elemY;
}

const renameBoundingClientRect = ({x:relX, y:relY, top:relTop, right:relRight, bottom:relBottom, left:relLeft, height, width}) => ({relX, relY, relTop, relRight, relBottom, relLeft, height, width});
function getElemBounds(elem) {
	let bounds = renameBoundingClientRect(elem.getBoundingClientRect());
	bounds.x = bounds.left = Math.floor(bounds.relX + window.scrollX);
	bounds.y = bounds.top = Math.floor(bounds.relY + window.scrollY);
	bounds.right = Math.floor(bounds.relRight + window.scrollX);
	bounds.bottom = Math.floor(bounds.relBottom + window.scrollY);
	return bounds;
}

//
// URL
//
function hrefInfo(container, newTab) {
	function mapToStr(prefix, map) {
		return Object.keys(map).length ? prefix + Object.entries(map).map(([k, v]) => Array.isArray(v) ? v.map(v => k+"[]="+v).join("&") : (k === "#" ? "" : k+"=")+v).join("&") : "";
	}
	function cloneMap(source, target, removed, renamed, argToPage) {
		return Object.entries(source).forEach(([k, v]) => target[k] || k === argToPage || removed.includes(k) || (target[renamed[k] || k] = source[k]));
	}
	let url = typeof container === "string" ? container : (container.href || container.src);
	url = url.match(/^[^:]+:\/\//) ? url : (url.startsWith("/") ? document.baseURI.replace(/^([^:]+:\/\/[^\/]+).*$/, "$1") : document.baseURI) + url;
	let info = /^(?<protocol>[^:]+):\/\/(?<hostname>[^:\/]+)(?<port>:\d+)?(?<path>(?:\/[^\/]*(?=\/))*)(?:\/(?<page>[^\/?#]*(?=$|[?#])))?(?:\?(?<search>[^#]+))?(?:#(?<hash>.+$))?$/.exec(url).groups;
	Object.entries(info).forEach(([k,v]) => info[k] = v ?? "");
	Object.assign(info, {
			newTab: newTab,
			args: {},
			host(){ return this.hostname + (this.port ? ":" + this.port : this.port) },
			pathname(page){ return this.path + "/" + this.getPage(page) },
			getPage(page){ return page === false ? "" : (page && page !== true) ? page : this.page },
			base(page){ return this.protocol + "://" + this.host() + this.pathname(page) },
			clone({newUrl = null, page = null, argToPage = null, pageToArg = null, removeArgs = [], addArgs = [], renameArgs = {}, removeHash = [], addHash = [], renameHash = {}} = {}){
				let clone = newUrl ? hrefInfo(newUrl) : Object.assign({}, this, {args:{}});
				Object.assign.apply(null, [clone.args, pageToArg ? {[pageToArg]:this.page} : {}, ...(Array.isArray(addArgs) ? addArgs : [addArgs])]);
				Object.assign.apply(null, [clone.hash, ...(Array.isArray(addHash) ? addHash : [addHash])]);
				Object.entries(this).forEach(([k, v]) => (k === "args" || k === "hash")
					? cloneMap(this[k], clone[k], k === "hash" ? removeHash : removeArgs, k === "hash" ? renameHash : renameArgs, argToPage)
					: !["page"].includes(k) || (clone[k] = clone[k] || v)
				);
				clone.page = clone.getPage((page && page !== true) || (page === false) || argToPage ? page??this.args[argToPage]??clone.args[argToPage] : !pageToArg);
				return clone;
			},
			build(options) {
				let info = options && Object.keys(options).length ? this.clone(options) : this;
				return info.base() + mapToStr("?", info.args) + mapToStr("#", info.hash);
			},
			apply(options) {
				container.href = this.build(options);
			}
	});
	for (let i = 0; i < 2; i++) {
		let isHash = i === 1;
		let mapStr = isHash ? info.hash : info.search;
		let map = isHash ? (info.hash = {}) : info.args;
		mapStr.split("&").forEach(arg => {
			if (arg) {
				let [name, value] = ((!isHash || arg.includes("=") ? "" : "#=") + arg).split("="), isArray = name.endsWith("[]");
				name = isArray ? name.substring(0, name.length-2) : name;
				map[name] = isArray ? ([...(map[name]||[]), value]) : value;
			}
		});
	}
	delete info.search;
	return info;
}

//
// AJAX
//
function ajax(url, data, method = "GET", {json=false, jsonRequest=false, jsonAnswer=false, ...options}={}) {
	method = method.toUpperCase();
	let useSearch = method === "GET" || method === "DELETE";

	return new Promise(function(resolve, reject) {
		console.log("ajax " + method + " request at " + url);
		let xhr = new XMLHttpRequest();
		xhr.open(method, url + (useSearch && data ? (url.indexOf("?") === -1 ? "?" : "&") + toPHPSearchParams(data) : ""));
		xhr.onload = function(event) {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					resolve(json || jsonAnswer ? JSON.parse(xhr.responseText) : xhr.responseText);
				} catch (e) {
					reject("unable to parse JSON: " + e + (xhr.responseText ? ":\n" + xhr.responseText : " (empty JSON)"), e);
				}
			} else {
				reject(xhr.status + " - " + xhr.statusText + (xhr.responseText ? ":\n" + xhr.responseText : ""));
			}
		};
		xhr.onerror = xhr.onabort = xhr.ontimeout = reject.bind(null, xhr);

		if (options) {
			for(const f in options) {
				if (xhr[f] && Object.prototype.toString.call(xhr[f]) === "[object Function]") {
					xhr[f].apply(xhr, options[f]);
				}
			}
		}

		if (!useSearch) {
			if (json || jsonRequest) {
				xhr.setRequestHeader('Content-Type', 'application/json');
				xhr.overrideMimeType("application/json; charset=utf-8");
				data = JSON.stringify(data);
			} else if (!(data instanceof FormData)) {
				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				data = toPHPSearchParams(data);
			}
		}
		xhr.send(useSearch ? null : data);
	}).catch(err => {console.error("An error occurred in the ajax request", err); return Promise.reject(err);});
}

function objectToParamArray(obj, paramName, keys=[]) {
	let type = getType(obj);
	switch(type.emptyOrType) {
		case "function":
			return false;
		case "array":
			return obj.map((v, i) => objectToParamArray(v, paramName, [...keys, i])).filter(a => a).flat();
		case "object":
			return Object.entries(obj).map(([k, v]) => objectToParamArray(v, paramName, [...keys, k])).filter(a => a).flat();
		default:
			return (paramName || keys.shift()) + (keys.length ? "["+keys.join("][")+"]" : "") + "=" + (type.empty ? "" : obj);
	}
}
function toPHPSearchParams(params, keepEmptyParams = true) {
	if (!(params instanceof FormData)) {
		let type = getType(params);
		params = type.object ? objectToParamArray(params) : params;
		type = type.object ? {array: true} : type;
		params = type.empty ? "" : (type.string ? params : (type.array ? params.join("&") : null));
		if (params === null) {
			console.error("the parameters cannot be of type " + type.type);
		}
	}
	params = params ? new URLSearchParams(params).toString() : params;
	return keepEmptyParams ? params : params?.replace(/(?<=&|^)[^&=]+=?(?:&|$)/g, "");
}