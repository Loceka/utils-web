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
 *     <script type="text/javascript" data-var="util" src="6.CSS.js"></script>
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

	const s = { param: "theme", fromHash: true, fromQuery: true, fromStorage: true, saveStorage: false, priority: ["fromHash", "fromQuery", "fromStorage"], themes: ["dark", "light"] };
	const theme = {
		firstCall: true,
		settings: s,
		theme(value) {
			return this.settings.themes.includes(value) && value;
		},
		cycleThemes() {
			const length = this.settings.themes.length, i = this.settings.themes.indexOf(this.selectedTheme());
			return this.settings.themes[(length + i + 1) % length];
		},
		storageKey() { return ((this.settings.storagePrefix ?? "") + ".").replace(/(?<=^|\.)\.$/, "") + this.settings.param; },
		selectedTheme() {
			return document.documentElement.dataset[this.settings.param];
		},
		selectMode(eventOrTheme) {
			if (eventOrTheme) {
				const theme = u.typeOf(eventOrTheme).string ? eventOrTheme : eventOrTheme.matches ? "dark" : "light";
				if (theme !== this.selectedTheme()) {
					document.documentElement.dataset[this.settings.param] = theme;
					if (this.settings.saveStorage) {
						window.localStorage?.setItem(this.storageKey(), theme);
					}
					this.settings.callback?.(theme);
				}
			}
		},
		readLocalStorage(obj = {}) {
			const value = this.settings.fromStorage && window.localStorage?.getItem(this.storageKey());
			return Object.assign(obj, {fromStorage: this.theme(value)});
		},
		readLocation(eventOrObject = {}) {
			const hashParams = this.settings.fromHash && new URLSearchParams(window.location.hash.substring(1));
			if (event instanceof Event) {
				this.selectMode(this.theme(hashParams?.get(this.settings.param)));
			} else {
				const queryParams = this.settings.fromQuery && new URLSearchParams(window.location.search);
				return Object.assign(eventOrObject, {fromHash: this.theme(hashParams?.get(this.settings.param)), fromQuery: this.theme(queryParams?.get(this.settings.param))});
			}
		},
		init({ toggle, callback = s.callback, param = s.param, fromHash = s.fromHash, fromQuery = s.fromQuery, fromStorage = s.fromStorage, storagePrefix = s.storagePrefix, saveStorage = s.saveStorage, priority = s.priority, themes = s.themes } = {}) {
			const oldSettings = {...this.settings};
			Object.assign(this.settings, { param:param, fromHash:fromHash, fromQuery:fromQuery, fromStorage:fromStorage, storagePrefix:storagePrefix, saveStorage:saveStorage, priority:priority, themes:themes, callback:callback });
			if (this.firstCall) {
				const matchDarkScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
				matchDarkScheme?.addEventListener("change", this.selectMode.bind(this));
				this.selectMode(matchDarkScheme);

				window.addEventListener('hashchange', this.readLocation.bind(this));
			}

			if (this.firstCall || ["param", "fromHash", "fromQuery", "fromStorage", "storagePrefix", "priority", "themes"].find(k => !u.equal(oldSettings[k], this.settings[k]))) {
				const read = this.readLocation(this.readLocalStorage());
				this.selectMode(read[this.settings.priority.find(source => read[source])]);
			}

			toggle = u.typeOf(arguments[0]).switch(value => ({string: value, boolean: value, default: toggle}));
			if (toggle) {
				this.selectMode(toggle === true ? this.cycleThemes() : this.theme(toggle));
			}

			this.firstCall = false;
			return { theme: this.selectedTheme(), toggle: toggle, ...this.settings };
		},
	};

	let customSheet, themeSet = false;
	return Object.assign(curScript, _.content({
        customStylesheet(stylesheetId = "customAddedStylesheet") {
			if (!customSheet) {
				document.head.insertAdjacentHTML('beforeend', `<style id="${stylesheetId}" type="text/css"></style>`);
				customSheet = document.getElementById(stylesheetId)?.sheet;
			}
			return customSheet;
        },
		/*
		 * Choose between dark and light mode themes (it still needs to be implemented CSS side by declaring variables in :root[data-theme="dark"]{} and :root[data-theme="light"]{})
		 *
		 * This function takes only 1 argument, which can be of different types :
		 * - string : the theme to set
		 * - boolean : cycle between themes
		 * - object settings = {
		 *     toggle        : same as string/boolean argument
		 *     callback      : a function to callback when the theme changes
		 *     param         : (default: "theme") the name of the parameter to use in HTML/CSS (data-[param] set on <html>) and to search in URL and localStorage
		 *     fromHash      : (default: true) search for theme in URL#hash values (using [param] as key). It will also listen for changes in the URL hash
		 *     fromQuery     : (default: true) search for theme in URL?query values (using [param] as key)
		 *     fromStorage   : (default: true) search for theme in localStorage values (using [storagePrefix].[param] as key)
		 *     storagePrefix : (default: unset) add a prefix to [param] in localStorage for search and save purposes
		 *     saveStorage   : (default: false) save the theme in localStorage (using [storagePrefix].[param] as key)
		 *     priority      : (default: ["fromHash", "fromQuery", "fromStorage"]) the priority of the sources : the first source found is used.
		 *     themes        : (default: ["dark", "light"]) the possible themes
		 * }
		 */
		selectTheme: theme.init.bind(theme),
		selectedTheme: theme.selectedTheme.bind(theme),
        customRule(ruleSelector, content) {
			const sheet = this.customStylesheet();
			let selectedIndex;
			let selectedRule = [...sheet.cssRules].find((r, i) => r.selectorText === ruleSelector && (selectedIndex = i) !== undefined);

			if (content !== undefined) {
				if (selectedIndex !== undefined) {
					sheet.deleteRule(selectedIndex);
					selectedRule = undefined;
				}
				if (content) {
					sheet.insertRule(`${ruleSelector} { ${content} }`, selectedIndex ?? sheet.cssRules.length);
					selectedRule = sheet.cssRules[sheet.cssRules.length-1];
				}
			}

			return selectedRule?.style;
		},
		getStyle(el, styleProp) {
			const defaultView = (el.ownerDocument ?? document).defaultView;
			let value;
			if (defaultView && defaultView.getComputedStyle) {
				// sanitize property name to css notation (hypen separated words eg. font-Size)
				styleProp = styleProp.replace(/(?<!-)([A-Z])/g, "-$1").toLowerCase();
				value = defaultView.getComputedStyle(el, null).getPropertyValue(styleProp);
			}
			return value;
		},
	}));
})();
