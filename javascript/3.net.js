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
	_.setLaunchDependencies({
		"u": 0
	});

	return Object.assign(curScript, _.content({
		hrefInfo(container, newTab) {
			const self = this;
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
						let clone = newUrl ? self.hrefInfo(newUrl) : Object.assign({}, this, {args:{}});
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
		},
		objectToParamArray(obj, paramName, keys=[]) {
			let type = _.u.getType(obj);
			switch(type.emptyOrType) {
				case "function":
					return false;
				case "array":
					return obj.map((v, i) => this.objectToParamArray(v, paramName, [...keys, i])).filter(a => a).flat();
				case "object":
					return Object.entries(obj).map(([k, v]) => this.objectToParamArray(v, paramName, [...keys, k])).filter(a => a).flat();
				default:
					return (paramName || keys.shift()) + (keys.length ? "["+keys.join("][")+"]" : "") + "=" + (type.empty ? "" : obj);
			}
		},
		toPHPSearchParams(params, keepEmptyParams = true) {
			if (!(params instanceof FormData)) {
				let type = _.u.getType(params);
				params = type.object ? this.objectToParamArray(params) : params;
				type = type.object ? {array: true} : type;
				params = type.empty ? "" : (type.string ? params : (type.array ? params.join("&") : null));
				if (params === null) {
					console.error("the parameters cannot be of type " + type.type);
				}
			}
			params = params ? new URLSearchParams(params).toString() : params;
			return keepEmptyParams ? params : params?.replace(/(?<=&|^)[^&=]+=?(?:&|$)/g, "");
		},
		ajax(url, data, method = "GET", {json=false, jsonRequest=false, jsonAnswer=false, ...options}={}) {
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
						data = this.toPHPSearchParams(data);
					}
				}
				xhr.send(useSearch ? null : data);
			}).catch(err => {console.error("An error occurred in the ajax request", err); return Promise.reject(err);});
		}
	}));
})();