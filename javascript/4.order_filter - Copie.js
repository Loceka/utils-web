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
	let curScript = (varName === undefined || varName === null) ? this : (varName ? (typeof varName === "object" ? varName : this[varName]??{}) : {});
	if (varName && (typeof varName === "string")) this[varName] = curScript;

	Script = Script || ((typeof loader === "undefined" || !loader) ? varName?.loader : loader)?.Script;
	const _ = Script ? new Script(id, autoVersion) : {
		setLaunchDependencies(deps) { Object.keys(deps).forEach(k => { this[k] = Object.assign(curScript, window[k] ?? (curScript !== window) ? window : {} ); }); },
		content(content) { return content; }
	};

	return Object.assign(curScript, _.content({
		SortOrder: class {
			static #SORT_PROTO = {
				set(property, value) { this[property] = value; return this; },
				clone(force) { return (this.cloned && !force) ? this : Object.setPrototypeOf({type: this.type, compare: this.compare, cloned: true}, Object.getPrototypeOf(this)); },
				rename(newType) { return this.clone(true).set("type", newType); },
				disable(value) { return this.clone().set("disabled", value !== false); },
			};
			static SortMethod(method) { Object.setPrototypeOf(method, this.#SORT_PROTO); return method; };

			static STRING = this.SortMethod({ type: "string", compare: (a, b) => String(a)?.localeCompare(String(b), this.lang) ?? (b ? 1 : 0) });
			static BOOLEAN = this.SortMethod({ type: "boolean", compare: (a, b) => (Boolean(a) ? 0 : 1) - (Boolean(b) ? 0 : 1) });
			static NUMERIC = this.SortMethod({ type: "numeric", compare: (a, b) => Number(a) - Number(b) });
			static DATE = this.SortMethod({ type: "date", compare: (a, b) => a?.getTime?.() ?? Number.MAX_SAFE_INTEGER - b?.getTime?.() ?? Number.MAX_SAFE_INTEGER });

			lang = "en";

			constructor(dataArray, dataSortedCallback, sortChangedCallback) {
				Object.entries(this.constructor).forEach(([k,v]) => this[k] = v); // make static fields also non-static
				this.setDataArray(dataArray);
				this.setDataSortedCallback(dataSortedCallback);
				this.setSortChangedCallback(sortChangedCallback);
			}

			#custo = {
				asc: "\u2191", desc: "\u2193",
				colorDisabled: "grey", colorEnabled: "blue",
				mixedColorDisabled: "grey", mixedColorEnabled: "black",
				mainStyle: "font-family: monospace; margin-left: 2px;",
				mixedTypesStyle: "top: -0.7em; padding-left: 1px; font-size: 0.8em; line-height: 0.9em; background-color: white; gap: 2px 1px;",
				mixedTypeStyle: "background-color: lightgray; color: black; padding: 2px; cursor: pointer;",
				mixedMinusPlusStyle: "display: flex; background-color: gray; color: whitesmoke; align-items: center; justify-content: center; padding: 0 4px;",
				mixedMinusStyle: "border-radius: 50% 0 0 50%;", mixedPlusStyle: "border-radius: 0 50% 50% 0;"
			};
			#i18n = {
				title_arrow_none: { en: "No specific order", fr: "Pas d'ordre spécifique" },
				title_arrow_asc: { en: "Sorted by ascending order", fr: "Tri croissant" },
				title_arrow_desc: { en: "Sorted by descending order", fr: "Tri décroissant" },
				title_arrow_alt: { en: "Ctrl+Click to remove", fr: "Ctrl+Click pour enlever" },
				title_arrow_mixed: { en: "Hold Ctrl to manage mixed types", fr: "Maintenir Ctrl pour gérer les types mixtes" },
				title_plus: { en: "Set this order as less important", fr: "Rendre ce tri moins important" },
				title_minus: { en: "Set this order as more important", fr: "Rendre ce tri plus important" },
				title_remove: { en: "Remove this sort order", fr: "Enlever ce tri" },
				title_sort_disable: { en: "Disable sort", fr: "Désactiver le tri" },
				title_sort_enable: { en: "Enable sort", fr: "Activer le tri" },
				type_string: { fr: "textuel" },
				type_numeric: { fr: "numérique" },
			};
			#headers = [];
			#selectedHeaders = [];

			#getChildIndex(elem, startIndex = 0, elemOfType = "*") {
				elemOfType = (typeof elemOfType === "boolean") ? (elemOfType ? elem.nodeName || "*" : "*") : elemOfType;
				let childNodes = elem ? elem.parentElement.querySelectorAll(":scope>" + elemOfType) : [];
				for (let i = startIndex, child; child = childNodes[i-startIndex]; i++) {
					if (child === elem) {
						return i;
					}
				}
				return -1;
			}
			#getNodePath(elem, startPath) {
				let path = [], start = startPath ? document.querySelector(startPath) : document;
				if (elem && start) {
					for (let child = elem, parent; (child !== start) && (parent = child.parentElement); child = parent) {
						if (!startPath && child.id) {
							startPath = "#" + child.id;
							start = parent;
						} else {
							path.push(">" + (child.nodeName||"*") + ":nth-of-type(" + this.#getChildIndex(child, 1, true) + ")");
						}
					}
					path.push(startPath || "html");
				} else {
					console.log("Erreur: getNodePath: aucun élément trouvé pour elem: '" + elem + "' ou startPath: '" + startPath + "'");
				}
				return start && path.reverse().join("");
			}

			setLang(lang) {
				this.lang = lang;
				return this;
			}

			i18n(k) {
				return this.#i18n?.[k]?.[this.lang] ?? this.#i18n?.[k]?.["en"] ?? k?.substring(k.indexOf("_")+1);
			}
			setI18n(i18n) {
				if (i18n === "?") {
					console.log("setI18n(i18n) with i18n like ", this.#i18n);
				} else {
					Object.assign(this.#i18n, i18n);
					this.clear(true);
				}
				return this;
			}

			setDataArray(dataArray) {
				if (!dataArray || !Array.isArray(dataArray)) throw "dataArray must be specified!";
				this.dataArray = dataArray;
			}

			setDataSortedCallback(dataSortedCallback) {
				if (typeof dataSortedCallback !== "function") throw "dataSortedCallback must be specified!";
				this.dataSortedCallback = dataSortedCallback;
			}

			setSortChangedCallback(sortChangedCallback) {
				this.sortChangedCallback = sortChangedCallback;
			}

			customize(display) {
				if (display === "?") {
					console.log("customize(display) with display like ", this.#custo);
				} else {
					Object.assign(this.#custo, display);
					this.clear(true);
				}
				return this;
			}

			clear(refresh) {
				this.#headers.forEach(({customOrder}) => { customOrder?.[refresh ? "create" : "remove"](); });
				if (!refresh) {
					this.#headers = [];
				}
				return this;
			}

			compare(a, b) {
				let header = this.#selectedHeaders[0];
				let res = 0;
				while (res === 0 && header) {
					res = header.customOrder?.compare(a, b);
					header = this.#selectedHeaders[header.customOrder?.rank ?? this.#selectedHeaders.length];
				}
				return res;
			}
			sort() {
				this.dataArray?.sort(this.compare.bind(this));
				this.dataSortedCallback(this.dataArray);
				return this.dataArray;
			}
			async asyncSort() {
				return this.sort();
			}

			import(json) {
				const saved = JSON.parse(json || "[]");
				this.#selectedHeaders.splice(0, this.#selectedHeaders.length);
				saved?.forEach(({path, direction, rank, sortedTypes}) => {
					const header = this.#headers.find(h => h.customOrder.path === path);
					if (header) {
						const customOrder = header.customOrder;
						customOrder.direction = direction;
						customOrder.rank = rank;
						sortedTypes?.forEach((t, i) => customOrder.mixedTypes[t].rank = i);
						customOrder.sortMixedTypes();
						customOrder.updateRank(rank);
					} else {
						console.error(`header ${path} not found`);
					}
				});
				this.asyncSort();
			}
			export() {
				return JSON.stringify(this.#selectedHeaders.map(({customOrder:{path, direction, rank, sortedTypes}}) => ({path, direction, rank, sortedTypes})));
			}

			mapAll(o) {
				if (o === "?") {
					let doc = "mapAll(param) can be used with an object or array parameter:";
					doc += "\n- object: { htmlHeader: {sortMethod, sortMethods, accessors} }";
					doc += "\n- array: [ {htmlHeader, sortMethod, sortMethods, accessors} ]";
					doc += "\nEach entry initiates a call to map(...):";
					this.map("?");
					console.log(doc);
				} else if (Array.isArray(o)) {
					o.forEach(({htmlHeader, sortMethod, sortMethods, ...accessors}) => this.map(htmlHeader, accessors, ...(sortMethod ? [sortMethod] : sortMethods??[]) ));
				} else {
					Object.entries(o).forEach(([htmlHeader, {sortMethod, sortMethods, ...accessors}]) => this.map(htmlHeader, accessors, ...(sortMethod ? [sortMethod] : sortMethods??[]) ));
				}

				return this;
			}

			// { accessor: {data, type}, sortUsing, defaultOrder }
			// { <typeName>: { accessor: data, sortUsing }, defaultOrder }
			// { accessor: {data, type}, sortUsing, <typeName>: { accessor: data, sortUsing }, defaultOrder }
			map(htmlHeader, {dataAccessor = (d) => d, typeAccessor, defaultOrder = 0} = {}, sortMethod = this.constructor.STRING, ...sortMethods) {
				if (htmlHeader === "?") {
					let doc = "map(htmlHeader, {dataAccessor, typeAccessor, defaultOrder = 0}, sortMethod = this.STRING, ...sortMethods) with:";
					doc += "\n- htmlHeader : [Mandatory] the html header element on which this sort should be applied";
					doc += "\n- dataAccessor : [Optional] the data property matching this header, or a function retrieving the right property from the given data object. If not set, the element itself is returned.";
					doc += "\n- typeAccessor : [Optional] a function retrieving the type of the current property (mandatory and useful only if the argument 'sortMethods' is set). It must match '<sortMethod>.type'.";
					doc += "\n- defaultOrder : [Optional] the default sort order of this header when no sort method has been called.";
					doc += "\n- sortMethod : [Optional] the sort order to apply on this property, if unset this.STRING will be used";
					doc += "\n- sortMethods : [Optional] a list of other sort orders that can be applied to this property if it has mixed types. the property '<sortMethod>.type' must be set and match the data type.";
					console.log(doc);
					return this;
				}

				const _ = this, sortMethodsCount = sortMethods.length + 1, isMixedTypes = sortMethodsCount > 1;

				function accessorToFunction(accessor) {
					return (typeof accessor === "function") ? accessor : (typeof accessor === "string") ? (data) => data[accessor] : null;
				}

				htmlHeader = (typeof htmlHeader === "string") ? document.querySelector(htmlHeader) : htmlHeader;
				dataAccessor = accessorToFunction(dataAccessor);
				typeAccessor = accessorToFunction(typeAccessor);

				if (!htmlHeader) throw "htmlHeader must be defined for map(htmlHeader, {dataAccessor, typeAccessor, defaultOrder}, sortMethod, ...sortMethods)";
				if (typeof dataAccessor !== "function") throw "typeAccessor must be defined for map(htmlHeader, {dataAccessor, typeAccessor, defaultOrder}, sortMethod, ...sortMethods)";
				if (isMixedTypes && (typeof typeAccessor !== "function")) throw "typeAccessor must be defined for map(htmlHeader, {dataAccessor, typeAccessor, defaultOrder}, sortMethod, ...sortMethods)";

				this.#headers.push(htmlHeader);

				htmlHeader.customOrder = {
					path: this.#getNodePath(htmlHeader),
					defaultDirection: defaultOrder ?? 0,
					direction: 0,
					rank: 0,
					dataAccessor: dataAccessor,
					typeAccessor: isMixedTypes ? typeAccessor : () => ["main"],
					mixedTypes: {},
					sortedTypes: ["main"],
					sortMixedTypes() {
						this.sortedTypes = Object.entries(this.mixedTypes).sort(([,{rank:rA}], [,{rank:rB}]) => rA - rB).map(([t]) => t);
					},
					compare(a, b) {
						let aTypes = this.typeAccessor(a, this.sortedTypes);
						aTypes = (Array.isArray(aTypes)) ? aTypes : [aTypes];
						let bTypes = this.typeAccessor(b, this.sortedTypes);
						bTypes = (Array.isArray(bTypes)) ? bTypes : [bTypes];
						let res = aTypes.length - bTypes.length;
						for (let i = 0, aType, bType; (res === 0) && (aType = aTypes[i]) && (bType = bTypes[i]); i++) {
							const mixedTypeA = this.mixedTypes[aType], mixedTypeB = this.mixedTypes[bType];
							if (!mixedTypeA.disabled && !mixedTypeB.disabled) {
								res = mixedTypeA.rank - mixedTypeB.rank;
								res ||= this.direction * mixedTypeA.sortMethod.compare(this.dataAccessor(a, aType), this.dataAccessor(b, bType));
							}
						}
						return res;
					},
					remove() {
						this.html?.orderElem?.parentElement?.removeChild(this.html.orderElem);
					},
					create() {
						this.remove();
						const mixedTypesDiv = `<div style="display: none; position: absolute; grid-template-columns: 1fr 1fr 1fr; ${_.#custo.mixedTypesStyle ?? ""}"></div>`;
						htmlHeader.insertAdjacentHTML("beforeend", `<span style="display:inline-block; position:relative; ${_.#custo.mainStyle ?? ""}"><span style="cursor: pointer">${_.#custo.asc}</span><sup style="display: none">${this.rank}</sup>${mixedTypesDiv}</span>`);
						const orderElem = htmlHeader.lastChild;
						this.html = {
							orderElem: orderElem,
							arrowElem: orderElem.firstChild,
							rankElem: orderElem.querySelector(":scope > sup"),
							mixedTypesElem: orderElem.querySelector(":scope > div"),
						};

						let mixedTriggered = false;
						orderElem.onmouseover = (ev) => {
							if (!mixedTriggered && isMixedTypes && (ev.ctrlKey || ev.metaKey)) {
								mixedTriggered = true;
								const prevVal = Object.entries(this.mixedTypes).reduce((o, [type, {rank, disabled}]) => (o[type] = {rank: rank, disabled: disabled}, o), {});
								const keyupHandler = (ev) => {
									if (!(ev.ctrlKey || ev.metaKey)) {
										this.html.mixedTypesElem.style.display = "none";
										document.removeEventListener("keyup", keyupHandler);
										if (_.#selectedHeaders.includes(htmlHeader) && Object.entries(this.mixedTypes).some(([type, {rank, disabled}]) => (prevVal[type].rank !== rank || prevVal[type].disabled != disabled))) {
											_.asyncSort();
											_.sortChangedCallback?.();
										}
										mixedTriggered = false;
									}
								};
								document.addEventListener("keyup", keyupHandler);
								this.html.mixedTypesElem.style.display = "inline-grid";
							}
						};
						(this.html.arrowElem.onclick = (ev) => {
							const init = ev === true;

							let changed = false;
							if (ev.ctrlKey || ev.metaKey) { // remove sort
								changed = this.direction !== 0;
								this.direction = 0;
							} else {
								changed = !init;
								this.direction = init ? this.direction : ((-1 * this.defaultDirection) || 1);
							}

							const newRank = init ? this.rank : (this.direction ? this.rank || _.#selectedHeaders.length + 1 : 0);
							changed |= this.updateRank(newRank, this.rank);

							if (changed && _.#selectedHeaders.length) _.asyncSort();
							if (!init) _.sortChangedCallback?.();
						})(true);
					},
					updateRank(newRank, oldRank) {
						const changed = newRank !== oldRank;
						if (changed) {
							if (newRank) {
								_.#selectedHeaders.push(htmlHeader);
							} else {
								_.#selectedHeaders.splice(this.rank - 1, 1);
							}
							_.#headers.forEach(h => {
								h.customOrder.rank = _.#selectedHeaders.indexOf(h) + 1;
								h.customOrder.html.rankElem.textContent = h.customOrder.rank;
								h.customOrder.html.rankElem.style.display = (h.customOrder.rank && _.#selectedHeaders.length > 1) ? "" : "none";
							});
						}
						this.defaultDirection = this.direction ? this.direction : (_.#selectedHeaders.length ? 0 : this.defaultDirection);

						this.html.arrowElem.title = `${_.i18n(this.defaultDirection ? (this.defaultDirection === 1 ? "title_arrow_asc" : "title_arrow_desc") : "title_arrow_none") + "\n" + _.i18n("title_arrow_alt") + (isMixedTypes ? "\n" + _.i18n("title_arrow_mixed") : "")}`;
						this.html.arrowElem.textContent = this.defaultDirection ? (this.defaultDirection === 1 ? _.#custo.asc : _.#custo.desc) : this.html.arrowElem.textContent;
						this.html.orderElem.style.color = this.rank ? _.#custo.colorEnabled : _.#custo.colorDisabled;

						return changed;
					},
				};

				htmlHeader.customOrder.create();

				function changeMixedRank(entry, limit, increment, ev) {
					if (ev === true) { // init
						this.style.cursor = entry.rank === limit ? "default" : "pointer";
						this.style.fontSize = entry.rank === limit ? "0" : "";
					} else {
						const newRank = entry.rank === limit ? entry.rank : entry.rank + increment;
						if (newRank !== entry.rank) {
							Object.values(htmlHeader.customOrder.mixedTypes).filter(({rank}) => rank === newRank).forEach(v => { v.rank = entry.rank; });
							entry.rank = newRank;
							htmlHeader.customOrder.sortMixedTypes();

							const firstElem = increment > 0 ? this.previousSibling.previousSibling : this;
							const curRow = [firstElem, firstElem.nextSibling, firstElem.nextSibling.nextSibling];
							const curIndex = Array.prototype.indexOf.call(this.parentNode.childNodes, this);
							const beforeElem = this.parentNode.childNodes[curIndex + (increment * 3 + (increment > 0 ? 1 : 0))];
							curRow.forEach(e => { this.parentNode.insertBefore(e, beforeElem); });
							this.parentNode.childNodes.forEach((e, i, a) => {
								if (i%3 === 0 || (i+1)%3 === 0) {
									e.style.cursor = (i === 0 || i === a.length - 1) ? "default" : "pointer";
									e.style.fontSize = (i === 0 || i === a.length - 1) ? "0" : "";
								}
							});
						}
					}
				}

				function toggleMixedSort(entry, ev) {
					const init = ev === true;
					entry.disabled = init ? entry.disabled : !entry.disabled;
					this.style.color = entry.disabled ? _.#custo.mixedColorDisabled : _.#custo.mixedColorEnabled;
					this.title = _.i18n(entry.disabled ? "title_sort_enable" : "title_sort_disable");
				}

				[sortMethod, ...sortMethods].forEach((o, i) => {
					const entry = htmlHeader.customOrder.mixedTypes[isMixedTypes ? o.type : "main"] = { sortMethod: o, rank: i, disabled: o.disabled };
					if (isMixedTypes) {
						const container = htmlHeader.customOrder.html.mixedTypesElem;
						container.insertAdjacentHTML("beforeend", `<div style="${(_.#custo.mixedMinusPlusStyle ?? "") + (_.#custo.mixedMinusStyle ?? "")}">&#x2191;</div><div style="${_.#custo.mixedTypeStyle ?? ""}">${_.i18n("type_" + o.type)}</div><div style="${(_.#custo.mixedMinusPlusStyle ?? "") + (_.#custo.mixedPlusStyle ?? "")}">&#x2193;</div>`);
						const minusElem = container.childNodes[container.childNodes.length - 3];
						(minusElem.onclick = changeMixedRank.bind(minusElem, entry, 0, -1))(true);
						const nameElem = container.childNodes[container.childNodes.length - 2];
						(nameElem.onclick = toggleMixedSort.bind(nameElem, entry))(true);
						const plusElem = container.lastChild;
						(plusElem.onclick = changeMixedRank.bind(plusElem, entry, sortMethodsCount - 1, 1))(true);
					}
				});
				if (isMixedTypes) {
					htmlHeader.customOrder.sortMixedTypes();
				}

				return this;
			}
		},
	}));
})();