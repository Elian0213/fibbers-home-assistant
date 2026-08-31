/*! Fibbers v0.2.0 — GENERATED from src/ by 'bun run build'. Do not hand-edit. */
(() => {

  // src/tokens.js
  var T = {
    bg: "#111516",
    card: "#1D2426",
    card2: "#262F31",
    line: "#333E41",
    ink: "#EDF1F1",
    ink2: "#A9B6B9",
    muted: "#7D8B8E",
    accent: "#74B98A",
    accentSoft: "rgba(116,185,138,.10)",
    accentBg: "#17281C",
    accentLine: "#2B4A34",
    accentTx: "#CFE6D5",
    amber: "#E8A33D",
    amberSoft: "rgba(232,163,61,.09)",
    amberBg: "#3A2B12",
    amberLine: "#4E3A18",
    amberTx: "#EBD9BC",
    blue: "#5AAFD6",
    blueBg: "#152B36",
    blueLine: "#2C5A70",
    blueInk: "#9BD2EA",
    green: "#63C295",
    red: "#EC8377",
    sheet: "#171E20",
    nav: "#161C1E",
    grab: "#3E4A4D",
    rowLine: "#262F31"
  };
  function styleBlock() {
    return `:host {
    --fib-bg: ${T.bg};
    --fib-card: ${T.card};
    --fib-card-2: ${T.card2};
    --fib-line: ${T.line};
    --fib-ink: ${T.ink};
    --fib-ink-2: ${T.ink2};
    --fib-muted: ${T.muted};
    --fib-accent: ${T.accent};
    --fib-accent-soft: ${T.accentSoft};
    --fib-accent-bg: ${T.accentBg};
    --fib-accent-line: ${T.accentLine};
    --fib-accent-tx: ${T.accentTx};
    --fib-amber: ${T.amber};
    --fib-amber-bg: ${T.amberBg};
    --fib-amber-line: ${T.amberLine};
    --fib-amber-tx: ${T.amberTx};
    --fib-blue: ${T.blue};
    --fib-blue-bg: ${T.blueBg};
    --fib-blue-line: ${T.blueLine};
    --fib-blue-ink: ${T.blueInk};
    --fib-green: ${T.green};
    --fib-red: ${T.red};
    --fib-sheet: ${T.sheet};
    --fib-nav: ${T.nav};
    --fib-grab: ${T.grab};
    --fib-row-line: ${T.rowLine};
  }`;
  }

  // src/util.js
  var store = {
    get(key, fallback) {
      try {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch (_) {}
    }
  };
  var norm = (p) => String(p || "").replace(/\/+$/, "") || "/";
  var here = () => norm(window.location.pathname);
  function navigate(path, { replace = false } = {}) {
    if (!path)
      return;
    if (String(path).startsWith("#")) {
      window.location.hash = path;
      return;
    }
    if (replace)
      history.replaceState(null, "", path);
    else
      history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace } }));
  }

  // src/nav-stack.js
  var NAV_KEY = "fibbers:navstack";
  var nav = {
    tabs: new Set,
    stack: store.get(NAV_KEY, []),
    listeners: new Set,
    hassRef: null
  };
  var registerTabs = (paths) => paths.forEach((p) => nav.tabs.add(norm(p)));
  var isTab = (path) => nav.tabs.has(norm(path));
  function onRouteChange() {
    const path = here();
    const s = nav.stack;
    if (isTab(path)) {
      nav.stack = [path];
    } else if (s.length >= 2 && norm(s[s.length - 2]) === path) {
      nav.stack = s.slice(0, -1);
    } else if (norm(s[s.length - 1]) !== path) {
      nav.stack = s.concat([path]);
    }
    if (nav.stack.length > 20)
      nav.stack = nav.stack.slice(-20);
    store.set(NAV_KEY, nav.stack);
    nav.listeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
  }
  var previous = () => nav.stack.length >= 2 ? nav.stack[nav.stack.length - 2] : null;
  function goBack(fallback) {
    const prev = previous();
    if (prev) {
      nav.stack = nav.stack.slice(0, -1);
      store.set(NAV_KEY, nav.stack);
      navigate(prev);
      return;
    }
    if (fallback) {
      navigate(fallback);
      return;
    }
    if (history.length > 1)
      history.back();
  }
  window.addEventListener("location-changed", onRouteChange);
  window.addEventListener("popstate", onRouteChange);
  onRouteChange();

  // node_modules/@lit/reactive-element/development/css-tag.js
  var NODE_MODE = false;
  var global = globalThis;
  var supportsAdoptingStyleSheets = global.ShadowRoot && (global.ShadyCSS === undefined || global.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
  var constructionToken = Symbol();
  var cssTagCache = new WeakMap;

  class CSSResult {
    constructor(cssText, strings, safeToken) {
      this["_$cssResult$"] = true;
      if (safeToken !== constructionToken) {
        throw new Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
      }
      this.cssText = cssText;
      this._strings = strings;
    }
    get styleSheet() {
      let styleSheet = this._styleSheet;
      const strings = this._strings;
      if (supportsAdoptingStyleSheets && styleSheet === undefined) {
        const cacheable = strings !== undefined && strings.length === 1;
        if (cacheable) {
          styleSheet = cssTagCache.get(strings);
        }
        if (styleSheet === undefined) {
          (this._styleSheet = styleSheet = new CSSStyleSheet).replaceSync(this.cssText);
          if (cacheable) {
            cssTagCache.set(strings, styleSheet);
          }
        }
      }
      return styleSheet;
    }
    toString() {
      return this.cssText;
    }
  }
  var textFromCSSResult = (value) => {
    if (value["_$cssResult$"] === true) {
      return value.cssText;
    } else if (typeof value === "number") {
      return value;
    } else {
      throw new Error(`Value passed to 'css' function must be a 'css' function result: ` + `${value}. Use 'unsafeCSS' to pass non-literal values, but take care ` + `to ensure page security.`);
    }
  };
  var unsafeCSS = (value) => new CSSResult(typeof value === "string" ? value : String(value), undefined, constructionToken);
  var css = (strings, ...values) => {
    const cssText = strings.length === 1 ? strings[0] : values.reduce((acc, v, idx) => acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
    return new CSSResult(cssText, strings, constructionToken);
  };
  var adoptStyles = (renderRoot, styles) => {
    if (supportsAdoptingStyleSheets) {
      renderRoot.adoptedStyleSheets = styles.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
    } else {
      for (const s of styles) {
        const style = document.createElement("style");
        const nonce = global["litNonce"];
        if (nonce !== undefined) {
          style.setAttribute("nonce", nonce);
        }
        style.textContent = s.cssText;
        renderRoot.appendChild(style);
      }
    }
  };
  var cssResultFromStyleSheet = (sheet) => {
    let cssText = "";
    for (const rule of sheet.cssRules) {
      cssText += rule.cssText;
    }
    return unsafeCSS(cssText);
  };
  var getCompatibleStyle = supportsAdoptingStyleSheets || NODE_MODE && global.CSSStyleSheet === undefined ? (s) => s : (s) => s instanceof CSSStyleSheet ? cssResultFromStyleSheet(s) : s;

  // node_modules/@lit/reactive-element/development/reactive-element.js
  var { is, defineProperty, getOwnPropertyDescriptor, getOwnPropertyNames, getOwnPropertySymbols, getPrototypeOf } = Object;
  var NODE_MODE2 = false;
  var global2 = globalThis;
  if (NODE_MODE2) {
    global2.customElements ??= customElements;
  }
  var DEV_MODE = true;
  var issueWarning;
  var trustedTypes = global2.trustedTypes;
  var emptyStringForBooleanAttribute = trustedTypes ? trustedTypes.emptyScript : "";
  var polyfillSupport = DEV_MODE ? global2.reactiveElementPolyfillSupportDevMode : global2.reactiveElementPolyfillSupport;
  if (DEV_MODE) {
    global2.litIssuedWarnings ??= new Set;
    issueWarning = (code, warning) => {
      warning += ` See https://lit.dev/msg/${code} for more information.`;
      if (!global2.litIssuedWarnings.has(warning) && !global2.litIssuedWarnings.has(code)) {
        console.warn(warning);
        global2.litIssuedWarnings.add(warning);
      }
    };
    queueMicrotask(() => {
      issueWarning("dev-mode", `Lit is in dev mode. Not recommended for production!`);
      if (global2.ShadyDOM?.inUse && polyfillSupport === undefined) {
        issueWarning("polyfill-support-missing", `Shadow DOM is being polyfilled via \`ShadyDOM\` but ` + `the \`polyfill-support\` module has not been loaded.`);
      }
    });
  }
  var debugLogEvent = DEV_MODE ? (event) => {
    const shouldEmit = global2.emitLitDebugLogEvents;
    if (!shouldEmit) {
      return;
    }
    global2.dispatchEvent(new CustomEvent("lit-debug", {
      detail: event
    }));
  } : undefined;
  var JSCompiler_renameProperty = (prop, _obj) => prop;
  var defaultConverter = {
    toAttribute(value, type) {
      switch (type) {
        case Boolean:
          value = value ? emptyStringForBooleanAttribute : null;
          break;
        case Object:
        case Array:
          value = value == null ? value : JSON.stringify(value);
          break;
      }
      return value;
    },
    fromAttribute(value, type) {
      let fromValue = value;
      switch (type) {
        case Boolean:
          fromValue = value !== null;
          break;
        case Number:
          fromValue = value === null ? null : Number(value);
          break;
        case Object:
        case Array:
          try {
            fromValue = JSON.parse(value);
          } catch (e) {
            fromValue = null;
          }
          break;
      }
      return fromValue;
    }
  };
  var notEqual = (value, old) => !is(value, old);
  var defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    useDefault: false,
    hasChanged: notEqual
  };
  Symbol.metadata ??= Symbol("metadata");
  global2.litPropertyMetadata ??= new WeakMap;

  class ReactiveElement extends HTMLElement {
    static addInitializer(initializer) {
      this.__prepare();
      (this._initializers ??= []).push(initializer);
    }
    static get observedAttributes() {
      this.finalize();
      return this.__attributeToPropertyMap && [...this.__attributeToPropertyMap.keys()];
    }
    static createProperty(name, options = defaultPropertyDeclaration) {
      if (options.state) {
        options.attribute = false;
      }
      this.__prepare();
      if (this.prototype.hasOwnProperty(name)) {
        options = Object.create(options);
        options.wrapped = true;
      }
      this.elementProperties.set(name, options);
      if (!options.noAccessor) {
        const key = DEV_MODE ? Symbol.for(`${String(name)} (@property() cache)`) : Symbol();
        const descriptor = this.getPropertyDescriptor(name, key, options);
        if (descriptor !== undefined) {
          defineProperty(this.prototype, name, descriptor);
        }
      }
    }
    static getPropertyDescriptor(name, key, options) {
      const { get, set } = getOwnPropertyDescriptor(this.prototype, name) ?? {
        get() {
          return this[key];
        },
        set(v) {
          this[key] = v;
        }
      };
      if (DEV_MODE && get == null) {
        if ("value" in (getOwnPropertyDescriptor(this.prototype, name) ?? {})) {
          throw new Error(`Field ${JSON.stringify(String(name))} on ` + `${this.name} was declared as a reactive property ` + `but it's actually declared as a value on the prototype. ` + `Usually this is due to using @property or @state on a method.`);
        }
        issueWarning("reactive-property-without-getter", `Field ${JSON.stringify(String(name))} on ` + `${this.name} was declared as a reactive property ` + `but it does not have a getter. This will be an error in a ` + `future version of Lit.`);
      }
      return {
        get,
        set(value) {
          const oldValue = get?.call(this);
          set?.call(this, value);
          this.requestUpdate(name, oldValue, options);
        },
        configurable: true,
        enumerable: true
      };
    }
    static getPropertyOptions(name) {
      return this.elementProperties.get(name) ?? defaultPropertyDeclaration;
    }
    static __prepare() {
      if (this.hasOwnProperty(JSCompiler_renameProperty("elementProperties", this))) {
        return;
      }
      const superCtor = getPrototypeOf(this);
      superCtor.finalize();
      if (superCtor._initializers !== undefined) {
        this._initializers = [...superCtor._initializers];
      }
      this.elementProperties = new Map(superCtor.elementProperties);
    }
    static finalize() {
      if (this.hasOwnProperty(JSCompiler_renameProperty("finalized", this))) {
        return;
      }
      this.finalized = true;
      this.__prepare();
      if (this.hasOwnProperty(JSCompiler_renameProperty("properties", this))) {
        const props = this.properties;
        const propKeys = [
          ...getOwnPropertyNames(props),
          ...getOwnPropertySymbols(props)
        ];
        for (const p of propKeys) {
          this.createProperty(p, props[p]);
        }
      }
      const metadata = this[Symbol.metadata];
      if (metadata !== null) {
        const properties = litPropertyMetadata.get(metadata);
        if (properties !== undefined) {
          for (const [p, options] of properties) {
            this.elementProperties.set(p, options);
          }
        }
      }
      this.__attributeToPropertyMap = new Map;
      for (const [p, options] of this.elementProperties) {
        const attr = this.__attributeNameForProperty(p, options);
        if (attr !== undefined) {
          this.__attributeToPropertyMap.set(attr, p);
        }
      }
      this.elementStyles = this.finalizeStyles(this.styles);
      if (DEV_MODE) {
        if (this.hasOwnProperty("createProperty")) {
          issueWarning("no-override-create-property", "Overriding ReactiveElement.createProperty() is deprecated. " + "The override will not be called with standard decorators");
        }
        if (this.hasOwnProperty("getPropertyDescriptor")) {
          issueWarning("no-override-get-property-descriptor", "Overriding ReactiveElement.getPropertyDescriptor() is deprecated. " + "The override will not be called with standard decorators");
        }
      }
    }
    static finalizeStyles(styles) {
      const elementStyles = [];
      if (Array.isArray(styles)) {
        const set = new Set(styles.flat(Infinity).reverse());
        for (const s of set) {
          elementStyles.unshift(getCompatibleStyle(s));
        }
      } else if (styles !== undefined) {
        elementStyles.push(getCompatibleStyle(styles));
      }
      return elementStyles;
    }
    static __attributeNameForProperty(name, options) {
      const attribute = options.attribute;
      return attribute === false ? undefined : typeof attribute === "string" ? attribute : typeof name === "string" ? name.toLowerCase() : undefined;
    }
    constructor() {
      super();
      this.__instanceProperties = undefined;
      this.isUpdatePending = false;
      this.hasUpdated = false;
      this.__reflectingProperty = null;
      this.__initialize();
    }
    __initialize() {
      this.__updatePromise = new Promise((res) => this.enableUpdating = res);
      this._$changedProperties = new Map;
      this.__saveInstanceProperties();
      this.requestUpdate();
      this.constructor._initializers?.forEach((i) => i(this));
    }
    addController(controller) {
      (this.__controllers ??= new Set).add(controller);
      if (this.renderRoot !== undefined && this.isConnected) {
        controller.hostConnected?.();
      }
    }
    removeController(controller) {
      this.__controllers?.delete(controller);
    }
    __saveInstanceProperties() {
      const instanceProperties = new Map;
      const elementProperties = this.constructor.elementProperties;
      for (const p of elementProperties.keys()) {
        if (this.hasOwnProperty(p)) {
          instanceProperties.set(p, this[p]);
          delete this[p];
        }
      }
      if (instanceProperties.size > 0) {
        this.__instanceProperties = instanceProperties;
      }
    }
    createRenderRoot() {
      const renderRoot = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
      adoptStyles(renderRoot, this.constructor.elementStyles);
      return renderRoot;
    }
    connectedCallback() {
      this.renderRoot ??= this.createRenderRoot();
      this.enableUpdating(true);
      this.__controllers?.forEach((c) => c.hostConnected?.());
    }
    enableUpdating(_requestedUpdate) {}
    disconnectedCallback() {
      this.__controllers?.forEach((c) => c.hostDisconnected?.());
    }
    attributeChangedCallback(name, _old, value) {
      this._$attributeToProperty(name, value);
    }
    __propertyToAttribute(name, value) {
      const elemProperties = this.constructor.elementProperties;
      const options = elemProperties.get(name);
      const attr = this.constructor.__attributeNameForProperty(name, options);
      if (attr !== undefined && options.reflect === true) {
        const converter = options.converter?.toAttribute !== undefined ? options.converter : defaultConverter;
        const attrValue = converter.toAttribute(value, options.type);
        if (DEV_MODE && this.constructor.enabledWarnings.includes("migration") && attrValue === undefined) {
          issueWarning("undefined-attribute-value", `The attribute value for the ${name} property is ` + `undefined on element ${this.localName}. The attribute will be ` + `removed, but in the previous version of \`ReactiveElement\`, ` + `the attribute would not have changed.`);
        }
        this.__reflectingProperty = name;
        if (attrValue == null) {
          this.removeAttribute(attr);
        } else {
          this.setAttribute(attr, attrValue);
        }
        this.__reflectingProperty = null;
      }
    }
    _$attributeToProperty(name, value) {
      const ctor = this.constructor;
      const propName = ctor.__attributeToPropertyMap.get(name);
      if (propName !== undefined && this.__reflectingProperty !== propName) {
        const options = ctor.getPropertyOptions(propName);
        const converter = typeof options.converter === "function" ? { fromAttribute: options.converter } : options.converter?.fromAttribute !== undefined ? options.converter : defaultConverter;
        this.__reflectingProperty = propName;
        const convertedValue = converter.fromAttribute(value, options.type);
        this[propName] = convertedValue ?? this.__defaultValues?.get(propName) ?? convertedValue;
        this.__reflectingProperty = null;
      }
    }
    requestUpdate(name, oldValue, options, useNewValue = false, newValue) {
      if (name !== undefined) {
        if (DEV_MODE && name instanceof Event) {
          issueWarning(``, `The requestUpdate() method was called with an Event as the property name. This is probably a mistake caused by binding this.requestUpdate as an event listener. Instead bind a function that will call it with no arguments: () => this.requestUpdate()`);
        }
        const ctor = this.constructor;
        if (useNewValue === false) {
          newValue = this[name];
        }
        options ??= ctor.getPropertyOptions(name);
        const changed = (options.hasChanged ?? notEqual)(newValue, oldValue) || options.useDefault && options.reflect && newValue === this.__defaultValues?.get(name) && !this.hasAttribute(ctor.__attributeNameForProperty(name, options));
        if (changed) {
          this._$changeProperty(name, oldValue, options);
        } else {
          return;
        }
      }
      if (this.isUpdatePending === false) {
        this.__updatePromise = this.__enqueueUpdate();
      }
    }
    _$changeProperty(name, oldValue, { useDefault, reflect, wrapped }, initializeValue) {
      if (useDefault && !(this.__defaultValues ??= new Map).has(name)) {
        this.__defaultValues.set(name, initializeValue ?? oldValue ?? this[name]);
        if (wrapped !== true || initializeValue !== undefined) {
          return;
        }
      }
      if (!this._$changedProperties.has(name)) {
        if (!this.hasUpdated && !useDefault) {
          oldValue = undefined;
        }
        this._$changedProperties.set(name, oldValue);
      }
      if (reflect === true && this.__reflectingProperty !== name) {
        (this.__reflectingProperties ??= new Set).add(name);
      }
    }
    async __enqueueUpdate() {
      this.isUpdatePending = true;
      try {
        await this.__updatePromise;
      } catch (e) {
        Promise.reject(e);
      }
      const result = this.scheduleUpdate();
      if (result != null) {
        await result;
      }
      return !this.isUpdatePending;
    }
    scheduleUpdate() {
      const result = this.performUpdate();
      if (DEV_MODE && this.constructor.enabledWarnings.includes("async-perform-update") && typeof result?.then === "function") {
        issueWarning("async-perform-update", `Element ${this.localName} returned a Promise from performUpdate(). ` + `This behavior is deprecated and will be removed in a future ` + `version of ReactiveElement.`);
      }
      return result;
    }
    performUpdate() {
      if (!this.isUpdatePending) {
        return;
      }
      debugLogEvent?.({ kind: "update" });
      if (!this.hasUpdated) {
        this.renderRoot ??= this.createRenderRoot();
        if (DEV_MODE) {
          const ctor = this.constructor;
          const shadowedProperties = [...ctor.elementProperties.keys()].filter((p) => this.hasOwnProperty(p) && (p in getPrototypeOf(this)));
          if (shadowedProperties.length) {
            throw new Error(`The following properties on element ${this.localName} will not ` + `trigger updates as expected because they are set using class ` + `fields: ${shadowedProperties.join(", ")}. ` + `Native class fields and some compiled output will overwrite ` + `accessors used for detecting changes. See ` + `https://lit.dev/msg/class-field-shadowing ` + `for more information.`);
          }
        }
        if (this.__instanceProperties) {
          for (const [p, value] of this.__instanceProperties) {
            this[p] = value;
          }
          this.__instanceProperties = undefined;
        }
        const elementProperties = this.constructor.elementProperties;
        if (elementProperties.size > 0) {
          for (const [p, options] of elementProperties) {
            const { wrapped } = options;
            const value = this[p];
            if (wrapped === true && !this._$changedProperties.has(p) && value !== undefined) {
              this._$changeProperty(p, undefined, options, value);
            }
          }
        }
      }
      let shouldUpdate = false;
      const changedProperties = this._$changedProperties;
      try {
        shouldUpdate = this.shouldUpdate(changedProperties);
        if (shouldUpdate) {
          this.willUpdate(changedProperties);
          this.__controllers?.forEach((c) => c.hostUpdate?.());
          this.update(changedProperties);
        } else {
          this.__markUpdated();
        }
      } catch (e) {
        shouldUpdate = false;
        this.__markUpdated();
        throw e;
      }
      if (shouldUpdate) {
        this._$didUpdate(changedProperties);
      }
    }
    willUpdate(_changedProperties) {}
    _$didUpdate(changedProperties) {
      this.__controllers?.forEach((c) => c.hostUpdated?.());
      if (!this.hasUpdated) {
        this.hasUpdated = true;
        this.firstUpdated(changedProperties);
      }
      this.updated(changedProperties);
      if (DEV_MODE && this.isUpdatePending && this.constructor.enabledWarnings.includes("change-in-update")) {
        issueWarning("change-in-update", `Element ${this.localName} scheduled an update ` + `(generally because a property was set) ` + `after an update completed, causing a new update to be scheduled. ` + `This is inefficient and should be avoided unless the next update ` + `can only be scheduled as a side effect of the previous update.`);
      }
    }
    __markUpdated() {
      this._$changedProperties = new Map;
      this.isUpdatePending = false;
    }
    get updateComplete() {
      return this.getUpdateComplete();
    }
    getUpdateComplete() {
      return this.__updatePromise;
    }
    shouldUpdate(_changedProperties) {
      return true;
    }
    update(_changedProperties) {
      this.__reflectingProperties &&= this.__reflectingProperties.forEach((p) => this.__propertyToAttribute(p, this[p]));
      this.__markUpdated();
    }
    updated(_changedProperties) {}
    firstUpdated(_changedProperties) {}
  }
  ReactiveElement.elementStyles = [];
  ReactiveElement.shadowRootOptions = { mode: "open" };
  ReactiveElement[JSCompiler_renameProperty("elementProperties", ReactiveElement)] = new Map;
  ReactiveElement[JSCompiler_renameProperty("finalized", ReactiveElement)] = new Map;
  polyfillSupport?.({ ReactiveElement });
  if (DEV_MODE) {
    ReactiveElement.enabledWarnings = [
      "change-in-update",
      "async-perform-update"
    ];
    const ensureOwnWarnings = function(ctor) {
      if (!ctor.hasOwnProperty(JSCompiler_renameProperty("enabledWarnings", ctor))) {
        ctor.enabledWarnings = ctor.enabledWarnings.slice();
      }
    };
    ReactiveElement.enableWarning = function(warning) {
      ensureOwnWarnings(this);
      if (!this.enabledWarnings.includes(warning)) {
        this.enabledWarnings.push(warning);
      }
    };
    ReactiveElement.disableWarning = function(warning) {
      ensureOwnWarnings(this);
      const i = this.enabledWarnings.indexOf(warning);
      if (i >= 0) {
        this.enabledWarnings.splice(i, 1);
      }
    };
  }
  (global2.reactiveElementVersions ??= []).push("2.1.2");
  if (DEV_MODE && global2.reactiveElementVersions.length > 1) {
    queueMicrotask(() => {
      issueWarning("multiple-versions", `Multiple versions of Lit loaded. Loading multiple versions ` + `is not recommended.`);
    });
  }

  // node_modules/lit-html/development/lit-html.js
  var DEV_MODE2 = true;
  var ENABLE_EXTRA_SECURITY_HOOKS = true;
  var ENABLE_SHADYDOM_NOPATCH = true;
  var NODE_MODE3 = false;
  var global3 = globalThis;
  var debugLogEvent2 = DEV_MODE2 ? (event) => {
    const shouldEmit = global3.emitLitDebugLogEvents;
    if (!shouldEmit) {
      return;
    }
    global3.dispatchEvent(new CustomEvent("lit-debug", {
      detail: event
    }));
  } : undefined;
  var debugLogRenderId = 0;
  var issueWarning2;
  if (DEV_MODE2) {
    global3.litIssuedWarnings ??= new Set;
    issueWarning2 = (code, warning) => {
      warning += code ? ` See https://lit.dev/msg/${code} for more information.` : "";
      if (!global3.litIssuedWarnings.has(warning) && !global3.litIssuedWarnings.has(code)) {
        console.warn(warning);
        global3.litIssuedWarnings.add(warning);
      }
    };
    queueMicrotask(() => {
      issueWarning2("dev-mode", `Lit is in dev mode. Not recommended for production!`);
    });
  }
  var wrap = ENABLE_SHADYDOM_NOPATCH && global3.ShadyDOM?.inUse && global3.ShadyDOM?.noPatch === true ? global3.ShadyDOM.wrap : (node) => node;
  var trustedTypes2 = global3.trustedTypes;
  var policy = trustedTypes2 ? trustedTypes2.createPolicy("lit-html", {
    createHTML: (s) => s
  }) : undefined;
  var identityFunction = (value) => value;
  var noopSanitizer = (_node, _name, _type) => identityFunction;
  var setSanitizer = (newSanitizer) => {
    if (!ENABLE_EXTRA_SECURITY_HOOKS) {
      return;
    }
    if (sanitizerFactoryInternal !== noopSanitizer) {
      throw new Error(`Attempted to overwrite existing lit-html security policy.` + ` setSanitizeDOMValueFactory should be called at most once.`);
    }
    sanitizerFactoryInternal = newSanitizer;
  };
  var _testOnlyClearSanitizerFactoryDoNotCallOrElse = () => {
    sanitizerFactoryInternal = noopSanitizer;
  };
  var createSanitizer = (node, name, type) => {
    return sanitizerFactoryInternal(node, name, type);
  };
  var boundAttributeSuffix = "$lit$";
  var marker = `lit$${Math.random().toFixed(9).slice(2)}$`;
  var markerMatch = "?" + marker;
  var nodeMarker = `<${markerMatch}>`;
  var d = NODE_MODE3 && global3.document === undefined ? {
    createTreeWalker() {
      return {};
    }
  } : document;
  var createMarker = () => d.createComment("");
  var isPrimitive = (value) => value === null || typeof value != "object" && typeof value != "function";
  var isArray = Array.isArray;
  var isIterable = (value) => isArray(value) || typeof value?.[Symbol.iterator] === "function";
  var SPACE_CHAR = `[ 	
\f\r]`;
  var ATTR_VALUE_CHAR = `[^ 	
\f\r"'\`<>=]`;
  var NAME_CHAR = `[^\\s"'>=/]`;
  var textEndRegex = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
  var COMMENT_START = 1;
  var TAG_NAME = 2;
  var DYNAMIC_TAG_NAME = 3;
  var commentEndRegex = /-->/g;
  var comment2EndRegex = />/g;
  var tagEndRegex = new RegExp(`>|${SPACE_CHAR}(?:(${NAME_CHAR}+)(${SPACE_CHAR}*=${SPACE_CHAR}*(?:${ATTR_VALUE_CHAR}|("|')|))|$)`, "g");
  var ENTIRE_MATCH = 0;
  var ATTRIBUTE_NAME = 1;
  var SPACES_AND_EQUALS = 2;
  var QUOTE_CHAR = 3;
  var singleQuoteAttrEndRegex = /'/g;
  var doubleQuoteAttrEndRegex = /"/g;
  var rawTextElement = /^(?:script|style|textarea|title)$/i;
  var HTML_RESULT = 1;
  var SVG_RESULT = 2;
  var MATHML_RESULT = 3;
  var ATTRIBUTE_PART = 1;
  var CHILD_PART = 2;
  var PROPERTY_PART = 3;
  var BOOLEAN_ATTRIBUTE_PART = 4;
  var EVENT_PART = 5;
  var ELEMENT_PART = 6;
  var COMMENT_PART = 7;
  var tag = (type) => (strings, ...values) => {
    if (DEV_MODE2 && strings.some((s) => s === undefined)) {
      console.warn(`Some template strings are undefined.
` + "This is probably caused by illegal octal escape sequences.");
    }
    if (DEV_MODE2) {
      if (values.some((val) => val?.["_$litStatic$"])) {
        issueWarning2("", `Static values 'literal' or 'unsafeStatic' cannot be used as values to non-static templates.
` + `Please use the static 'html' tag function. See https://lit.dev/docs/templates/expressions/#static-expressions`);
      }
    }
    return {
      ["_$litType$"]: type,
      strings,
      values
    };
  };
  var html = tag(HTML_RESULT);
  var svg = tag(SVG_RESULT);
  var mathml = tag(MATHML_RESULT);
  var noChange = Symbol.for("lit-noChange");
  var nothing = Symbol.for("lit-nothing");
  var templateCache = new WeakMap;
  var walker = d.createTreeWalker(d, 129);
  var sanitizerFactoryInternal = noopSanitizer;
  function trustFromTemplateString(tsa, stringFromTSA) {
    if (!isArray(tsa) || !tsa.hasOwnProperty("raw")) {
      let message = "invalid template strings array";
      if (DEV_MODE2) {
        message = `
          Internal Error: expected template strings to be an array
          with a 'raw' field. Faking a template strings array by
          calling html or svg like an ordinary function is effectively
          the same as calling unsafeHtml and can lead to major security
          issues, e.g. opening your code up to XSS attacks.
          If you're using the html or svg tagged template functions normally
          and still seeing this error, please file a bug at
          https://github.com/lit/lit/issues/new?template=bug_report.md
          and include information about your build tooling, if any.
        `.trim().replace(/\n */g, `
`);
      }
      throw new Error(message);
    }
    return policy !== undefined ? policy.createHTML(stringFromTSA) : stringFromTSA;
  }
  var getTemplateHtml = (strings, type) => {
    const l = strings.length - 1;
    const attrNames = [];
    let html2 = type === SVG_RESULT ? "<svg>" : type === MATHML_RESULT ? "<math>" : "";
    let rawTextEndRegex;
    let regex = textEndRegex;
    for (let i = 0;i < l; i++) {
      const s = strings[i];
      let attrNameEndIndex = -1;
      let attrName;
      let lastIndex = 0;
      let match;
      while (lastIndex < s.length) {
        regex.lastIndex = lastIndex;
        match = regex.exec(s);
        if (match === null) {
          break;
        }
        lastIndex = regex.lastIndex;
        if (regex === textEndRegex) {
          if (match[COMMENT_START] === "!--") {
            regex = commentEndRegex;
          } else if (match[COMMENT_START] !== undefined) {
            regex = comment2EndRegex;
          } else if (match[TAG_NAME] !== undefined) {
            if (rawTextElement.test(match[TAG_NAME])) {
              rawTextEndRegex = new RegExp(`</${match[TAG_NAME]}`, "g");
            }
            regex = tagEndRegex;
          } else if (match[DYNAMIC_TAG_NAME] !== undefined) {
            if (DEV_MODE2) {
              throw new Error("Bindings in tag names are not supported. Please use static templates instead. " + "See https://lit.dev/docs/templates/expressions/#static-expressions");
            }
            regex = tagEndRegex;
          }
        } else if (regex === tagEndRegex) {
          if (match[ENTIRE_MATCH] === ">") {
            regex = rawTextEndRegex ?? textEndRegex;
            attrNameEndIndex = -1;
          } else if (match[ATTRIBUTE_NAME] === undefined) {
            attrNameEndIndex = -2;
          } else {
            attrNameEndIndex = regex.lastIndex - match[SPACES_AND_EQUALS].length;
            attrName = match[ATTRIBUTE_NAME];
            regex = match[QUOTE_CHAR] === undefined ? tagEndRegex : match[QUOTE_CHAR] === '"' ? doubleQuoteAttrEndRegex : singleQuoteAttrEndRegex;
          }
        } else if (regex === doubleQuoteAttrEndRegex || regex === singleQuoteAttrEndRegex) {
          regex = tagEndRegex;
        } else if (regex === commentEndRegex || regex === comment2EndRegex) {
          regex = textEndRegex;
        } else {
          regex = tagEndRegex;
          rawTextEndRegex = undefined;
        }
      }
      if (DEV_MODE2) {
        console.assert(attrNameEndIndex === -1 || regex === tagEndRegex || regex === singleQuoteAttrEndRegex || regex === doubleQuoteAttrEndRegex, "unexpected parse state B");
      }
      const end = regex === tagEndRegex && strings[i + 1].startsWith("/>") ? " " : "";
      html2 += regex === textEndRegex ? s + nodeMarker : attrNameEndIndex >= 0 ? (attrNames.push(attrName), s.slice(0, attrNameEndIndex) + boundAttributeSuffix + s.slice(attrNameEndIndex)) + marker + end : s + marker + (attrNameEndIndex === -2 ? i : end);
    }
    const htmlResult = html2 + (strings[l] || "<?>") + (type === SVG_RESULT ? "</svg>" : type === MATHML_RESULT ? "</math>" : "");
    return [trustFromTemplateString(strings, htmlResult), attrNames];
  };

  class Template {
    constructor({ strings, ["_$litType$"]: type }, options) {
      this.parts = [];
      let node;
      let nodeIndex = 0;
      let attrNameIndex = 0;
      const partCount = strings.length - 1;
      const parts = this.parts;
      const [html2, attrNames] = getTemplateHtml(strings, type);
      this.el = Template.createElement(html2, options);
      walker.currentNode = this.el.content;
      if (type === SVG_RESULT || type === MATHML_RESULT) {
        const wrapper = this.el.content.firstChild;
        wrapper.replaceWith(...wrapper.childNodes);
      }
      while ((node = walker.nextNode()) !== null && parts.length < partCount) {
        if (node.nodeType === 1) {
          if (DEV_MODE2) {
            const tag2 = node.localName;
            if (/^(?:textarea|template)$/i.test(tag2) && node.innerHTML.includes(marker)) {
              const m = `Expressions are not supported inside \`${tag2}\` ` + `elements. See https://lit.dev/msg/expression-in-${tag2} for more ` + `information.`;
              if (tag2 === "template") {
                throw new Error(m);
              } else
                issueWarning2("", m);
            }
          }
          if (node.hasAttributes()) {
            for (const name of node.getAttributeNames()) {
              if (name.endsWith(boundAttributeSuffix)) {
                const realName = attrNames[attrNameIndex++];
                const value = node.getAttribute(name);
                const statics = value.split(marker);
                const m = /([.?@])?(.*)/.exec(realName);
                parts.push({
                  type: ATTRIBUTE_PART,
                  index: nodeIndex,
                  name: m[2],
                  strings: statics,
                  ctor: m[1] === "." ? PropertyPart : m[1] === "?" ? BooleanAttributePart : m[1] === "@" ? EventPart : AttributePart
                });
                node.removeAttribute(name);
              } else if (name.startsWith(marker)) {
                parts.push({
                  type: ELEMENT_PART,
                  index: nodeIndex
                });
                node.removeAttribute(name);
              }
            }
          }
          if (rawTextElement.test(node.tagName)) {
            const strings2 = node.textContent.split(marker);
            const lastIndex = strings2.length - 1;
            if (lastIndex > 0) {
              node.textContent = trustedTypes2 ? trustedTypes2.emptyScript : "";
              for (let i = 0;i < lastIndex; i++) {
                node.append(strings2[i], createMarker());
                walker.nextNode();
                parts.push({ type: CHILD_PART, index: ++nodeIndex });
              }
              node.append(strings2[lastIndex], createMarker());
            }
          }
        } else if (node.nodeType === 8) {
          const data = node.data;
          if (data === markerMatch) {
            parts.push({ type: CHILD_PART, index: nodeIndex });
          } else {
            let i = -1;
            while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
              parts.push({ type: COMMENT_PART, index: nodeIndex });
              i += marker.length - 1;
            }
          }
        }
        nodeIndex++;
      }
      if (DEV_MODE2) {
        if (attrNames.length !== attrNameIndex) {
          throw new Error(`Detected duplicate attribute bindings. This occurs if your template ` + `has duplicate attributes on an element tag. For example ` + `"<input ?disabled=\${true} ?disabled=\${false}>" contains a ` + `duplicate "disabled" attribute. The error was detected in ` + `the following template: 
` + "`" + strings.join("${...}") + "`");
        }
      }
      debugLogEvent2 && debugLogEvent2({
        kind: "template prep",
        template: this,
        clonableTemplate: this.el,
        parts: this.parts,
        strings
      });
    }
    static createElement(html2, _options) {
      const el = d.createElement("template");
      el.innerHTML = html2;
      return el;
    }
  }
  function resolveDirective(part, value, parent = part, attributeIndex) {
    if (value === noChange) {
      return value;
    }
    let currentDirective = attributeIndex !== undefined ? parent.__directives?.[attributeIndex] : parent.__directive;
    const nextDirectiveConstructor = isPrimitive(value) ? undefined : value["_$litDirective$"];
    if (currentDirective?.constructor !== nextDirectiveConstructor) {
      currentDirective?.["_$notifyDirectiveConnectionChanged"]?.(false);
      if (nextDirectiveConstructor === undefined) {
        currentDirective = undefined;
      } else {
        currentDirective = new nextDirectiveConstructor(part);
        currentDirective._$initialize(part, parent, attributeIndex);
      }
      if (attributeIndex !== undefined) {
        (parent.__directives ??= [])[attributeIndex] = currentDirective;
      } else {
        parent.__directive = currentDirective;
      }
    }
    if (currentDirective !== undefined) {
      value = resolveDirective(part, currentDirective._$resolve(part, value.values), currentDirective, attributeIndex);
    }
    return value;
  }

  class TemplateInstance {
    constructor(template, parent) {
      this._$parts = [];
      this._$disconnectableChildren = undefined;
      this._$template = template;
      this._$parent = parent;
    }
    get parentNode() {
      return this._$parent.parentNode;
    }
    get _$isConnected() {
      return this._$parent._$isConnected;
    }
    _clone(options) {
      const { el: { content }, parts } = this._$template;
      const fragment = (options?.creationScope ?? d).importNode(content, true);
      walker.currentNode = fragment;
      let node = walker.nextNode();
      let nodeIndex = 0;
      let partIndex = 0;
      let templatePart = parts[0];
      while (templatePart !== undefined) {
        if (nodeIndex === templatePart.index) {
          let part;
          if (templatePart.type === CHILD_PART) {
            part = new ChildPart(node, node.nextSibling, this, options);
          } else if (templatePart.type === ATTRIBUTE_PART) {
            part = new templatePart.ctor(node, templatePart.name, templatePart.strings, this, options);
          } else if (templatePart.type === ELEMENT_PART) {
            part = new ElementPart(node, this, options);
          }
          this._$parts.push(part);
          templatePart = parts[++partIndex];
        }
        if (nodeIndex !== templatePart?.index) {
          node = walker.nextNode();
          nodeIndex++;
        }
      }
      walker.currentNode = d;
      return fragment;
    }
    _update(values) {
      let i = 0;
      for (const part of this._$parts) {
        if (part !== undefined) {
          debugLogEvent2 && debugLogEvent2({
            kind: "set part",
            part,
            value: values[i],
            valueIndex: i,
            values,
            templateInstance: this
          });
          if (part.strings !== undefined) {
            part._$setValue(values, part, i);
            i += part.strings.length - 2;
          } else {
            part._$setValue(values[i]);
          }
        }
        i++;
      }
    }
  }

  class ChildPart {
    get _$isConnected() {
      return this._$parent?._$isConnected ?? this.__isConnected;
    }
    constructor(startNode, endNode, parent, options) {
      this.type = CHILD_PART;
      this._$committedValue = nothing;
      this._$disconnectableChildren = undefined;
      this._$startNode = startNode;
      this._$endNode = endNode;
      this._$parent = parent;
      this.options = options;
      this.__isConnected = options?.isConnected ?? true;
      if (ENABLE_EXTRA_SECURITY_HOOKS) {
        this._textSanitizer = undefined;
      }
    }
    get parentNode() {
      let parentNode = wrap(this._$startNode).parentNode;
      const parent = this._$parent;
      if (parent !== undefined && parentNode?.nodeType === 11) {
        parentNode = parent.parentNode;
      }
      return parentNode;
    }
    get startNode() {
      return this._$startNode;
    }
    get endNode() {
      return this._$endNode;
    }
    _$setValue(value, directiveParent = this) {
      if (DEV_MODE2 && this.parentNode === null) {
        throw new Error(`This \`ChildPart\` has no \`parentNode\` and therefore cannot accept a value. This likely means the element containing the part was manipulated in an unsupported way outside of Lit's control such that the part's marker nodes were ejected from DOM. For example, setting the element's \`innerHTML\` or \`textContent\` can do this.`);
      }
      value = resolveDirective(this, value, directiveParent);
      if (isPrimitive(value)) {
        if (value === nothing || value == null || value === "") {
          if (this._$committedValue !== nothing) {
            debugLogEvent2 && debugLogEvent2({
              kind: "commit nothing to child",
              start: this._$startNode,
              end: this._$endNode,
              parent: this._$parent,
              options: this.options
            });
            this._$clear();
          }
          this._$committedValue = nothing;
        } else if (value !== this._$committedValue && value !== noChange) {
          this._commitText(value);
        }
      } else if (value["_$litType$"] !== undefined) {
        this._commitTemplateResult(value);
      } else if (value.nodeType !== undefined) {
        if (DEV_MODE2 && this.options?.host === value) {
          this._commitText(`[probable mistake: rendered a template's host in itself ` + `(commonly caused by writing \${this} in a template]`);
          console.warn(`Attempted to render the template host`, value, `inside itself. This is almost always a mistake, and in dev mode `, `we render some warning text. In production however, we'll `, `render it, which will usually result in an error, and sometimes `, `in the element disappearing from the DOM.`);
          return;
        }
        this._commitNode(value);
      } else if (isIterable(value)) {
        this._commitIterable(value);
      } else {
        this._commitText(value);
      }
    }
    _insert(node) {
      return wrap(wrap(this._$startNode).parentNode).insertBefore(node, this._$endNode);
    }
    _commitNode(value) {
      if (this._$committedValue !== value) {
        this._$clear();
        if (ENABLE_EXTRA_SECURITY_HOOKS && sanitizerFactoryInternal !== noopSanitizer) {
          const parentNodeName = this._$startNode.parentNode?.nodeName;
          if (parentNodeName === "STYLE" || parentNodeName === "SCRIPT") {
            let message = "Forbidden";
            if (DEV_MODE2) {
              if (parentNodeName === "STYLE") {
                message = `Lit does not support binding inside style nodes. ` + `This is a security risk, as style injection attacks can ` + `exfiltrate data and spoof UIs. ` + `Consider instead using css\`...\` literals ` + `to compose styles, and do dynamic styling with ` + `css custom properties, ::parts, <slot>s, ` + `and by mutating the DOM rather than stylesheets.`;
              } else {
                message = `Lit does not support binding inside script nodes. ` + `This is a security risk, as it could allow arbitrary ` + `code execution.`;
              }
            }
            throw new Error(message);
          }
        }
        debugLogEvent2 && debugLogEvent2({
          kind: "commit node",
          start: this._$startNode,
          parent: this._$parent,
          value,
          options: this.options
        });
        this._$committedValue = this._insert(value);
      }
    }
    _commitText(value) {
      if (this._$committedValue !== nothing && isPrimitive(this._$committedValue)) {
        const node = wrap(this._$startNode).nextSibling;
        if (ENABLE_EXTRA_SECURITY_HOOKS) {
          if (this._textSanitizer === undefined) {
            this._textSanitizer = createSanitizer(node, "data", "property");
          }
          value = this._textSanitizer(value);
        }
        debugLogEvent2 && debugLogEvent2({
          kind: "commit text",
          node,
          value,
          options: this.options
        });
        node.data = value;
      } else {
        if (ENABLE_EXTRA_SECURITY_HOOKS) {
          const textNode = d.createTextNode("");
          this._commitNode(textNode);
          if (this._textSanitizer === undefined) {
            this._textSanitizer = createSanitizer(textNode, "data", "property");
          }
          value = this._textSanitizer(value);
          debugLogEvent2 && debugLogEvent2({
            kind: "commit text",
            node: textNode,
            value,
            options: this.options
          });
          textNode.data = value;
        } else {
          this._commitNode(d.createTextNode(value));
          debugLogEvent2 && debugLogEvent2({
            kind: "commit text",
            node: wrap(this._$startNode).nextSibling,
            value,
            options: this.options
          });
        }
      }
      this._$committedValue = value;
    }
    _commitTemplateResult(result) {
      const { values, ["_$litType$"]: type } = result;
      const template = typeof type === "number" ? this._$getTemplate(result) : (type.el === undefined && (type.el = Template.createElement(trustFromTemplateString(type.h, type.h[0]), this.options)), type);
      if (this._$committedValue?._$template === template) {
        debugLogEvent2 && debugLogEvent2({
          kind: "template updating",
          template,
          instance: this._$committedValue,
          parts: this._$committedValue._$parts,
          options: this.options,
          values
        });
        this._$committedValue._update(values);
      } else {
        const instance = new TemplateInstance(template, this);
        const fragment = instance._clone(this.options);
        debugLogEvent2 && debugLogEvent2({
          kind: "template instantiated",
          template,
          instance,
          parts: instance._$parts,
          options: this.options,
          fragment,
          values
        });
        instance._update(values);
        debugLogEvent2 && debugLogEvent2({
          kind: "template instantiated and updated",
          template,
          instance,
          parts: instance._$parts,
          options: this.options,
          fragment,
          values
        });
        this._commitNode(fragment);
        this._$committedValue = instance;
      }
    }
    _$getTemplate(result) {
      let template = templateCache.get(result.strings);
      if (template === undefined) {
        templateCache.set(result.strings, template = new Template(result));
      }
      return template;
    }
    _commitIterable(value) {
      if (!isArray(this._$committedValue)) {
        this._$committedValue = [];
        this._$clear();
      }
      const itemParts = this._$committedValue;
      let partIndex = 0;
      let itemPart;
      for (const item of value) {
        if (partIndex === itemParts.length) {
          itemParts.push(itemPart = new ChildPart(this._insert(createMarker()), this._insert(createMarker()), this, this.options));
        } else {
          itemPart = itemParts[partIndex];
        }
        itemPart._$setValue(item);
        partIndex++;
      }
      if (partIndex < itemParts.length) {
        this._$clear(itemPart && wrap(itemPart._$endNode).nextSibling, partIndex);
        itemParts.length = partIndex;
      }
    }
    _$clear(start = wrap(this._$startNode).nextSibling, from) {
      this._$notifyConnectionChanged?.(false, true, from);
      while (start !== this._$endNode) {
        const n = wrap(start).nextSibling;
        wrap(start).remove();
        start = n;
      }
    }
    setConnected(isConnected) {
      if (this._$parent === undefined) {
        this.__isConnected = isConnected;
        this._$notifyConnectionChanged?.(isConnected);
      } else if (DEV_MODE2) {
        throw new Error("part.setConnected() may only be called on a " + "RootPart returned from render().");
      }
    }
  }

  class AttributePart {
    get tagName() {
      return this.element.tagName;
    }
    get _$isConnected() {
      return this._$parent._$isConnected;
    }
    constructor(element, name, strings, parent, options) {
      this.type = ATTRIBUTE_PART;
      this._$committedValue = nothing;
      this._$disconnectableChildren = undefined;
      this.element = element;
      this.name = name;
      this._$parent = parent;
      this.options = options;
      if (strings.length > 2 || strings[0] !== "" || strings[1] !== "") {
        this._$committedValue = new Array(strings.length - 1).fill(new String);
        this.strings = strings;
      } else {
        this._$committedValue = nothing;
      }
      if (ENABLE_EXTRA_SECURITY_HOOKS) {
        this._sanitizer = undefined;
      }
    }
    _$setValue(value, directiveParent = this, valueIndex, noCommit) {
      const strings = this.strings;
      let change = false;
      if (strings === undefined) {
        value = resolveDirective(this, value, directiveParent, 0);
        change = !isPrimitive(value) || value !== this._$committedValue && value !== noChange;
        if (change) {
          this._$committedValue = value;
        }
      } else {
        const values = value;
        value = strings[0];
        let i, v;
        for (i = 0;i < strings.length - 1; i++) {
          v = resolveDirective(this, values[valueIndex + i], directiveParent, i);
          if (v === noChange) {
            v = this._$committedValue[i];
          }
          change ||= !isPrimitive(v) || v !== this._$committedValue[i];
          if (v === nothing) {
            value = nothing;
          } else if (value !== nothing) {
            value += (v ?? "") + strings[i + 1];
          }
          this._$committedValue[i] = v;
        }
      }
      if (change && !noCommit) {
        this._commitValue(value);
      }
    }
    _commitValue(value) {
      if (value === nothing) {
        wrap(this.element).removeAttribute(this.name);
      } else {
        if (ENABLE_EXTRA_SECURITY_HOOKS) {
          if (this._sanitizer === undefined) {
            this._sanitizer = sanitizerFactoryInternal(this.element, this.name, "attribute");
          }
          value = this._sanitizer(value ?? "");
        }
        debugLogEvent2 && debugLogEvent2({
          kind: "commit attribute",
          element: this.element,
          name: this.name,
          value,
          options: this.options
        });
        wrap(this.element).setAttribute(this.name, value ?? "");
      }
    }
  }

  class PropertyPart extends AttributePart {
    constructor() {
      super(...arguments);
      this.type = PROPERTY_PART;
    }
    _commitValue(value) {
      if (ENABLE_EXTRA_SECURITY_HOOKS) {
        if (this._sanitizer === undefined) {
          this._sanitizer = sanitizerFactoryInternal(this.element, this.name, "property");
        }
        value = this._sanitizer(value);
      }
      debugLogEvent2 && debugLogEvent2({
        kind: "commit property",
        element: this.element,
        name: this.name,
        value,
        options: this.options
      });
      this.element[this.name] = value === nothing ? undefined : value;
    }
  }

  class BooleanAttributePart extends AttributePart {
    constructor() {
      super(...arguments);
      this.type = BOOLEAN_ATTRIBUTE_PART;
    }
    _commitValue(value) {
      debugLogEvent2 && debugLogEvent2({
        kind: "commit boolean attribute",
        element: this.element,
        name: this.name,
        value: !!(value && value !== nothing),
        options: this.options
      });
      wrap(this.element).toggleAttribute(this.name, !!value && value !== nothing);
    }
  }

  class EventPart extends AttributePart {
    constructor(element, name, strings, parent, options) {
      super(element, name, strings, parent, options);
      this.type = EVENT_PART;
      if (DEV_MODE2 && this.strings !== undefined) {
        throw new Error(`A \`<${element.localName}>\` has a \`@${name}=...\` listener with ` + "invalid content. Event listeners in templates must have exactly " + "one expression and no surrounding text.");
      }
    }
    _$setValue(newListener, directiveParent = this) {
      newListener = resolveDirective(this, newListener, directiveParent, 0) ?? nothing;
      if (newListener === noChange) {
        return;
      }
      const oldListener = this._$committedValue;
      const shouldRemoveListener = newListener === nothing && oldListener !== nothing || newListener.capture !== oldListener.capture || newListener.once !== oldListener.once || newListener.passive !== oldListener.passive;
      const shouldAddListener = newListener !== nothing && (oldListener === nothing || shouldRemoveListener);
      debugLogEvent2 && debugLogEvent2({
        kind: "commit event listener",
        element: this.element,
        name: this.name,
        value: newListener,
        options: this.options,
        removeListener: shouldRemoveListener,
        addListener: shouldAddListener,
        oldListener
      });
      if (shouldRemoveListener) {
        this.element.removeEventListener(this.name, this, oldListener);
      }
      if (shouldAddListener) {
        this.element.addEventListener(this.name, this, newListener);
      }
      this._$committedValue = newListener;
    }
    handleEvent(event) {
      if (typeof this._$committedValue === "function") {
        this._$committedValue.call(this.options?.host ?? this.element, event);
      } else {
        this._$committedValue.handleEvent(event);
      }
    }
  }

  class ElementPart {
    constructor(element, parent, options) {
      this.element = element;
      this.type = ELEMENT_PART;
      this._$disconnectableChildren = undefined;
      this._$parent = parent;
      this.options = options;
    }
    get _$isConnected() {
      return this._$parent._$isConnected;
    }
    _$setValue(value) {
      debugLogEvent2 && debugLogEvent2({
        kind: "commit to element binding",
        element: this.element,
        value,
        options: this.options
      });
      resolveDirective(this, value);
    }
  }
  var polyfillSupport2 = DEV_MODE2 ? global3.litHtmlPolyfillSupportDevMode : global3.litHtmlPolyfillSupport;
  polyfillSupport2?.(Template, ChildPart);
  (global3.litHtmlVersions ??= []).push("3.3.3");
  if (DEV_MODE2 && global3.litHtmlVersions.length > 1) {
    queueMicrotask(() => {
      issueWarning2("multiple-versions", `Multiple versions of Lit loaded. ` + `Loading multiple versions is not recommended.`);
    });
  }
  var render = (value, container, options) => {
    if (DEV_MODE2 && container == null) {
      throw new TypeError(`The container to render into may not be ${container}`);
    }
    const renderId = DEV_MODE2 ? debugLogRenderId++ : 0;
    const partOwnerNode = options?.renderBefore ?? container;
    let part = partOwnerNode["_$litPart$"];
    debugLogEvent2 && debugLogEvent2({
      kind: "begin render",
      id: renderId,
      value,
      container,
      options,
      part
    });
    if (part === undefined) {
      const endNode = options?.renderBefore ?? null;
      partOwnerNode["_$litPart$"] = part = new ChildPart(container.insertBefore(createMarker(), endNode), endNode, undefined, options ?? {});
    }
    part._$setValue(value);
    debugLogEvent2 && debugLogEvent2({
      kind: "end render",
      id: renderId,
      value,
      container,
      options,
      part
    });
    return part;
  };
  if (ENABLE_EXTRA_SECURITY_HOOKS) {
    render.setSanitizer = setSanitizer;
    render.createSanitizer = createSanitizer;
    if (DEV_MODE2) {
      render._testOnlyClearSanitizerFactoryDoNotCallOrElse = _testOnlyClearSanitizerFactoryDoNotCallOrElse;
    }
  }

  // node_modules/lit-element/development/lit-element.js
  var JSCompiler_renameProperty2 = (prop, _obj) => prop;
  var DEV_MODE3 = true;
  var global4 = globalThis;
  var issueWarning3;
  if (DEV_MODE3) {
    global4.litIssuedWarnings ??= new Set;
    issueWarning3 = (code, warning) => {
      warning += ` See https://lit.dev/msg/${code} for more information.`;
      if (!global4.litIssuedWarnings.has(warning) && !global4.litIssuedWarnings.has(code)) {
        console.warn(warning);
        global4.litIssuedWarnings.add(warning);
      }
    };
  }

  class LitElement extends ReactiveElement {
    constructor() {
      super(...arguments);
      this.renderOptions = { host: this };
      this.__childPart = undefined;
    }
    createRenderRoot() {
      const renderRoot = super.createRenderRoot();
      this.renderOptions.renderBefore ??= renderRoot.firstChild;
      return renderRoot;
    }
    update(changedProperties) {
      const value = this.render();
      if (!this.hasUpdated) {
        this.renderOptions.isConnected = this.isConnected;
      }
      super.update(changedProperties);
      this.__childPart = render(value, this.renderRoot, this.renderOptions);
    }
    connectedCallback() {
      super.connectedCallback();
      this.__childPart?.setConnected(true);
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      this.__childPart?.setConnected(false);
    }
    render() {
      return noChange;
    }
  }
  LitElement["_$litElement$"] = true;
  LitElement[JSCompiler_renameProperty2("finalized", LitElement)] = true;
  global4.litElementHydrateSupport?.({ LitElement });
  var polyfillSupport3 = DEV_MODE3 ? global4.litElementPolyfillSupportDevMode : global4.litElementPolyfillSupport;
  polyfillSupport3?.({ LitElement });
  (global4.litElementVersions ??= []).push("4.2.2");
  if (DEV_MODE3 && global4.litElementVersions.length > 1) {
    queueMicrotask(() => {
      issueWarning3("multiple-versions", `Multiple versions of Lit loaded. Loading multiple versions ` + `is not recommended.`);
    });
  }
  // src/tailwind.gen.js
  var TW_CSS = `/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */
@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-translate-x:0;--tw-translate-y:0;--tw-translate-z:0;--tw-rotate-x:initial;--tw-rotate-y:initial;--tw-rotate-z:initial;--tw-skew-x:initial;--tw-skew-y:initial;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial;--tw-backdrop-blur:initial;--tw-backdrop-brightness:initial;--tw-backdrop-contrast:initial;--tw-backdrop-grayscale:initial;--tw-backdrop-hue-rotate:initial;--tw-backdrop-invert:initial;--tw-backdrop-opacity:initial;--tw-backdrop-saturate:initial;--tw-backdrop-sepia:initial;--tw-scale-x:1;--tw-scale-y:1;--tw-scale-z:1}}}@layer theme{:root,:host{--font-sans:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";--font-mono:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;--color-white:#fff;--spacing:.25rem;--font-weight-medium:500;--font-weight-semibold:600;--tracking-tight:-.025em;--leading-tight:1.25;--radius-lg:.5rem;--radius-xl:.75rem;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--default-font-family:var(--font-sans);--default-mono-font-family:var(--font-mono);--color-card:#1d2426;--color-card2:#262f31;--color-line:#333e41;--color-ink:#edf1f1;--color-ink2:#a9b6b9;--color-muted:#7d8b8e;--color-accent:#74b98a;--color-accentbg:#17281c;--color-accentline:#2b4a34;--color-accenttx:#cfe6d5;--color-amber:#e8a33d;--color-amberbg:#3a2b12;--color-amberline:#4e3a18;--color-ambertx:#ebd9bc;--color-blue:#5aafd6;--color-bluebg:#152b36;--color-blueline:#2c5a70;--color-blueink:#9bd2ea;--color-green:#63c295;--color-red:#ec8377}}@layer base{*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}::file-selector-button{box-sizing:border-box;border:0 solid;margin:0;padding:0}html,:host{-webkit-text-size-adjust:100%;tab-size:4;line-height:1.5;font-family:var(--default-font-family,-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");font-feature-settings:var(--default-font-feature-settings,normal);font-variation-settings:var(--default-font-variation-settings,normal);-webkit-tap-highlight-color:transparent}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;-webkit-text-decoration:inherit;-webkit-text-decoration:inherit;-webkit-text-decoration:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,samp,pre{font-family:var(--default-mono-font-family,ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);font-feature-settings:var(--default-mono-font-feature-settings,normal);font-variation-settings:var(--default-mono-font-variation-settings,normal);font-size:1em}small{font-size:80%}sub,sup{vertical-align:baseline;font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}:-moz-focusring:where(:not(iframe)){outline:auto}progress{vertical-align:baseline}summary{display:list-item}ol,ul,menu{list-style:none}img,svg,video,canvas,audio,iframe,embed,object{vertical-align:middle;display:block}img,video{max-width:100%;height:auto}button,input,select,optgroup,textarea{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}::file-selector-button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}:where(select:is([multiple],[size])) optgroup{font-weight:bolder}:where(select:is([multiple],[size])) optgroup option{padding-inline-start:20px}::file-selector-button{margin-inline-end:4px}::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){::placeholder{color:currentColor}@supports (color:color-mix(in lab, red, red)){::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}}textarea{resize:vertical}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-date-and-time-value{min-height:1lh;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-datetime-edit{padding-block:0}::-webkit-datetime-edit-year-field{padding-block:0}::-webkit-datetime-edit-month-field{padding-block:0}::-webkit-datetime-edit-day-field{padding-block:0}::-webkit-datetime-edit-hour-field{padding-block:0}::-webkit-datetime-edit-minute-field{padding-block:0}::-webkit-datetime-edit-second-field{padding-block:0}::-webkit-datetime-edit-millisecond-field{padding-block:0}::-webkit-datetime-edit-meridiem-field{padding-block:0}::-webkit-calendar-picker-indicator{line-height:1}:-moz-ui-invalid{box-shadow:none}button,input:where([type=button],[type=reset],[type=submit]){appearance:button}::file-selector-button{appearance:button}::-webkit-inner-spin-button{height:auto}::-webkit-outer-spin-button{height:auto}[hidden]:where(:not([hidden=until-found])){display:none!important}}@layer components;@layer utilities{.pointer-events-none{pointer-events:none}.collapse{visibility:collapse}.invisible{visibility:hidden}.visible{visibility:visible}.absolute{position:absolute}.fixed{position:fixed}.relative{position:relative}.static{position:static}.top-0{top:0}.top-0\\.5{top:calc(var(--spacing) * .5)}.top-1{top:var(--spacing)}.top-1\\/2{top:50%}.bottom-0{bottom:0}.left-0{left:0}.left-0\\.5{left:calc(var(--spacing) * .5)}.left-1{left:var(--spacing)}.left-1\\/2{left:50%}.left-\\[18px\\]{left:18px}.col-start-2{grid-column-start:2}.row-span-2{grid-row:span 2/span 2}.container{width:100%}@media (min-width:40rem){.container{max-width:40rem}}@media (min-width:48rem){.container{max-width:48rem}}@media (min-width:64rem){.container{max-width:64rem}}@media (min-width:80rem){.container{max-width:80rem}}@media (min-width:96rem){.container{max-width:96rem}}.mt-0{margin-top:0}.mt-0\\.5{margin-top:calc(var(--spacing) * .5)}.mt-1{margin-top:var(--spacing)}.mt-1\\.5{margin-top:calc(var(--spacing) * 1.5)}.mt-2{margin-top:calc(var(--spacing) * 2)}.mt-3{margin-top:calc(var(--spacing) * 3)}.mb-1{margin-bottom:var(--spacing)}.mb-2{margin-bottom:calc(var(--spacing) * 2)}.mb-2\\.5{margin-bottom:calc(var(--spacing) * 2.5)}.mb-3{margin-bottom:calc(var(--spacing) * 3)}.ml-0{margin-left:0}.ml-0\\.5{margin-left:calc(var(--spacing) * .5)}.ml-2{margin-left:calc(var(--spacing) * 2)}.ml-\\[7px\\]{margin-left:7px}.ml-auto{margin-left:auto}.block{display:block}.contents{display:contents}.flex{display:flex}.grid{display:grid}.hidden{display:none}.inline{display:inline}.inline-flex{display:inline-flex}.table{display:table}.h-1{height:var(--spacing)}.h-1\\.5{height:calc(var(--spacing) * 1.5)}.h-3{height:calc(var(--spacing) * 3)}.h-3\\.5{height:calc(var(--spacing) * 3.5)}.h-4{height:calc(var(--spacing) * 4)}.h-5{height:calc(var(--spacing) * 5)}.h-6{height:calc(var(--spacing) * 6)}.h-7{height:calc(var(--spacing) * 7)}.h-9{height:calc(var(--spacing) * 9)}.h-10{height:calc(var(--spacing) * 10)}.h-11{height:calc(var(--spacing) * 11)}.h-14{height:calc(var(--spacing) * 14)}.h-\\[5px\\]{height:5px}.h-\\[13px\\]{height:13px}.h-\\[15px\\]{height:15px}.h-\\[17px\\]{height:17px}.h-\\[18px\\]{height:18px}.h-\\[19px\\]{height:19px}.h-\\[20px\\]{height:20px}.h-\\[26px\\]{height:26px}.h-\\[30px\\]{height:30px}.h-\\[34px\\]{height:34px}.h-\\[42px\\]{height:42px}.w-3{width:calc(var(--spacing) * 3)}.w-3\\.5{width:calc(var(--spacing) * 3.5)}.w-4{width:calc(var(--spacing) * 4)}.w-5{width:calc(var(--spacing) * 5)}.w-6{width:calc(var(--spacing) * 6)}.w-7{width:calc(var(--spacing) * 7)}.w-9{width:calc(var(--spacing) * 9)}.w-10{width:calc(var(--spacing) * 10)}.w-11{width:calc(var(--spacing) * 11)}.w-14{width:calc(var(--spacing) * 14)}.w-\\[5px\\]{width:5px}.w-\\[13px\\]{width:13px}.w-\\[15px\\]{width:15px}.w-\\[17px\\]{width:17px}.w-\\[18px\\]{width:18px}.w-\\[19px\\]{width:19px}.w-\\[20px\\]{width:20px}.w-\\[26px\\]{width:26px}.w-\\[30px\\]{width:30px}.w-\\[34px\\]{width:34px}.w-\\[42px\\]{width:42px}.w-full{width:100%}.min-w-0{min-width:0}.min-w-\\[68px\\]{min-width:68px}.flex-1{flex:1}.flex-none{flex:none}.-translate-x-1{--tw-translate-x:calc(var(--spacing) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.-translate-x-1\\/2{--tw-translate-x:calc(calc(1 / 2 * 100%) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.-translate-y-1{--tw-translate-y:calc(var(--spacing) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.-translate-y-1\\/2{--tw-translate-y:calc(calc(1 / 2 * 100%) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.rotate-180{rotate:180deg}.transform{transform:var(--tw-rotate-x,) var(--tw-rotate-y,) var(--tw-rotate-z,) var(--tw-skew-x,) var(--tw-skew-y,)}.cursor-pointer{cursor:pointer}.touch-none{touch-action:none}.resize{resize:both}.auto-cols-fr{grid-auto-columns:minmax(0,1fr)}.grid-flow-col{grid-auto-flow:column}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-cols-\\[28px_1fr\\]{grid-template-columns:28px 1fr}.grid-cols-\\[28px_1fr_auto\\]{grid-template-columns:28px 1fr auto}.grid-cols-\\[34px_1fr\\]{grid-template-columns:34px 1fr}.grid-cols-\\[repeat\\(auto-fit\\,minmax\\(84px\\,1fr\\)\\)\\]{grid-template-columns:repeat(auto-fit,minmax(84px,1fr))}.grid-rows-\\[auto_auto\\]{grid-template-rows:auto auto}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.items-baseline{align-items:baseline}.items-center{align-items:center}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.gap-1{gap:var(--spacing)}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.gap-2{gap:calc(var(--spacing) * 2)}.gap-2\\.5{gap:calc(var(--spacing) * 2.5)}.gap-3{gap:calc(var(--spacing) * 3)}.gap-4{gap:calc(var(--spacing) * 4)}.gap-\\[3px\\]{gap:3px}.gap-\\[5px\\]{gap:5px}.gap-\\[7px\\]{gap:7px}.gap-x-2{column-gap:calc(var(--spacing) * 2)}.gap-x-2\\.5{column-gap:calc(var(--spacing) * 2.5)}.gap-x-3{column-gap:calc(var(--spacing) * 3)}.gap-x-\\[11px\\]{column-gap:11px}.gap-y-0{row-gap:0}.gap-y-0\\.5{row-gap:calc(var(--spacing) * .5)}.gap-y-2{row-gap:calc(var(--spacing) * 2)}.truncate{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.overflow-hidden{overflow:hidden}.rounded{border-radius:.25rem}.rounded-\\[3px\\]{border-radius:3px}.rounded-\\[9px\\]{border-radius:9px}.rounded-\\[10px\\]{border-radius:10px}.rounded-\\[11px\\]{border-radius:11px}.rounded-\\[14px\\]{border-radius:14px}.rounded-\\[15px\\]{border-radius:15px}.rounded-full{border-radius:3.40282e38px}.rounded-lg{border-radius:var(--radius-lg)}.rounded-xl{border-radius:var(--radius-xl)}.border{border-style:var(--tw-border-style);border-width:1px}.border-0{border-style:var(--tw-border-style);border-width:0}.border-\\[\\#2E5238\\]{border-color:#2e5238}.border-accentline{border-color:var(--color-accentline)}.border-amberline{border-color:var(--color-amberline)}.border-blueline{border-color:var(--color-blueline)}.border-line{border-color:var(--color-line)}.bg-\\[\\#2C3639\\]{background-color:#2c3639}.bg-\\[rgba\\(116\\,185\\,138\\,0\\.10\\)\\]{background-color:#74b98a1a}.bg-accent{background-color:var(--color-accent)}.bg-accentbg{background-color:var(--color-accentbg)}.bg-amberbg{background-color:var(--color-amberbg)}.bg-bluebg{background-color:var(--color-bluebg)}.bg-card{background-color:var(--color-card)}.bg-card2{background-color:var(--color-card2)}.bg-transparent{background-color:#0000}.bg-white{background-color:var(--color-white)}.bg-\\[linear-gradient\\(145deg\\,\\#1E3427\\,\\#132016\\)\\]{background-image:linear-gradient(145deg,#1e3427,#132016)}.bg-cover{background-size:cover}.bg-center{background-position:50%}.p-3{padding:calc(var(--spacing) * 3)}.p-3\\.5{padding:calc(var(--spacing) * 3.5)}.p-\\[13px\\]{padding:13px}.px-0{padding-inline:0}.px-0\\.5{padding-inline:calc(var(--spacing) * .5)}.px-1{padding-inline:var(--spacing)}.px-2{padding-inline:calc(var(--spacing) * 2)}.px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)}.px-3{padding-inline:calc(var(--spacing) * 3)}.px-3\\.5{padding-inline:calc(var(--spacing) * 3.5)}.px-\\[13px\\]{padding-inline:13px}.py-1{padding-block:var(--spacing)}.py-1\\.5{padding-block:calc(var(--spacing) * 1.5)}.py-2{padding-block:calc(var(--spacing) * 2)}.py-3{padding-block:calc(var(--spacing) * 3)}.py-\\[5px\\]{padding-block:5px}.py-\\[7px\\]{padding-block:7px}.py-\\[9px\\]{padding-block:9px}.pt-0{padding-top:0}.pt-0\\.5{padding-top:calc(var(--spacing) * .5)}.pt-\\[5px\\]{padding-top:5px}.pt-\\[7px\\]{padding-top:7px}.pt-\\[13px\\]{padding-top:13px}.pr-\\[11px\\]{padding-right:11px}.pb-1{padding-bottom:var(--spacing)}.pb-1\\.5{padding-bottom:calc(var(--spacing) * 1.5)}.pb-3{padding-bottom:calc(var(--spacing) * 3)}.pb-\\[3px\\]{padding-bottom:3px}.pl-\\[7px\\]{padding-left:7px}.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}.font-mono{font-family:var(--font-mono)}.text-\\[9\\.5px\\]{font-size:9.5px}.text-\\[10\\.5px\\]{font-size:10.5px}.text-\\[10px\\]{font-size:10px}.text-\\[11\\.5px\\]{font-size:11.5px}.text-\\[11px\\]{font-size:11px}.text-\\[12\\.5px\\]{font-size:12.5px}.text-\\[12px\\]{font-size:12px}.text-\\[13px\\]{font-size:13px}.text-\\[14px\\]{font-size:14px}.text-\\[15px\\]{font-size:15px}.text-\\[16px\\]{font-size:16px}.text-\\[17px\\]{font-size:17px}.text-\\[22px\\]{font-size:22px}.text-\\[24px\\]{font-size:24px}.text-\\[26px\\]{font-size:26px}.text-\\[30px\\]{font-size:30px}.leading-\\[1\\.1\\]{--tw-leading:1.1;line-height:1.1}.leading-\\[1\\.15\\]{--tw-leading:1.15;line-height:1.15}.leading-\\[1\\.25\\]{--tw-leading:1.25;line-height:1.25}.leading-\\[1\\.42\\]{--tw-leading:1.42;line-height:1.42}.leading-none{--tw-leading:1;line-height:1}.leading-tight{--tw-leading:var(--leading-tight);line-height:var(--leading-tight)}.font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}.font-semibold{--tw-font-weight:var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.tracking-\\[-0\\.015em\\]{--tw-tracking:-.015em;letter-spacing:-.015em}.tracking-\\[0\\.01em\\]{--tw-tracking:.01em;letter-spacing:.01em}.tracking-\\[0\\.06em\\]{--tw-tracking:.06em;letter-spacing:.06em}.tracking-\\[0\\.08em\\]{--tw-tracking:.08em;letter-spacing:.08em}.tracking-\\[0\\.11em\\]{--tw-tracking:.11em;letter-spacing:.11em}.tracking-tight{--tw-tracking:var(--tracking-tight);letter-spacing:var(--tracking-tight)}.text-ellipsis{text-overflow:ellipsis}.whitespace-nowrap{white-space:nowrap}.text-accent{color:var(--color-accent)}.text-accenttx{color:var(--color-accenttx)}.text-amber{color:var(--color-amber)}.text-ambertx{color:var(--color-ambertx)}.text-blue{color:var(--color-blue)}.text-blueink{color:var(--color-blueink)}.text-green{color:var(--color-green)}.text-ink{color:var(--color-ink)}.text-ink2{color:var(--color-ink2)}.text-muted{color:var(--color-muted)}.text-red{color:var(--color-red)}.capitalize{text-transform:capitalize}.uppercase{text-transform:uppercase}.opacity-50{opacity:.5}.opacity-\\[\\.66\\]{opacity:.66}.shadow{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-\\[0_1px_3px_rgba\\(0\\,0\\,0\\,\\.4\\)\\]{--tw-shadow:0 1px 3px var(--tw-shadow-color,#0006);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-\\[0_1px_3px_rgba\\(0\\,0\\,0\\,\\.35\\)\\]{--tw-shadow:0 1px 3px var(--tw-shadow-color,#00000059);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.outline{outline-style:var(--tw-outline-style);outline-width:1px}.filter{filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)}.backdrop-filter{-webkit-backdrop-filter:var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);backdrop-filter:var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,)}.transition{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to,opacity,box-shadow,transform,translate,scale,rotate,filter,-webkit-backdrop-filter,backdrop-filter,display,content-visibility,overlay,pointer-events;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-all{transition-property:all;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-transform{transition-property:transform,translate,scale,rotate;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.\\[--mdc-icon-size\\:13px\\]{--mdc-icon-size:13px}.\\[--mdc-icon-size\\:14px\\]{--mdc-icon-size:14px}.\\[--mdc-icon-size\\:15px\\]{--mdc-icon-size:15px}.\\[--mdc-icon-size\\:16px\\]{--mdc-icon-size:16px}.\\[--mdc-icon-size\\:17px\\]{--mdc-icon-size:17px}.\\[--mdc-icon-size\\:18px\\]{--mdc-icon-size:18px}.\\[--mdc-icon-size\\:19px\\]{--mdc-icon-size:19px}.\\[--mdc-icon-size\\:20px\\]{--mdc-icon-size:20px}.\\[--mdc-icon-size\\:24px\\]{--mdc-icon-size:24px}.\\[--mdc-icon-size\\:34px\\]{--mdc-icon-size:34px}@media (hover:hover){.hover\\:bg-card2:hover{background-color:var(--color-card2)}}.focus-visible\\:outline:focus-visible{outline-style:var(--tw-outline-style);outline-width:1px}.focus-visible\\:outline-2:focus-visible{outline-style:var(--tw-outline-style);outline-width:2px}.focus-visible\\:\\[outline-offset\\:-2px\\]:focus-visible{outline-offset:-2px}.focus-visible\\:outline-accent:focus-visible{outline-color:var(--color-accent)}.active\\:translate-y-\\[0\\.5px\\]:active{--tw-translate-y:.5px;translate:var(--tw-translate-x) var(--tw-translate-y)}.active\\:scale-90:active{--tw-scale-x:90%;--tw-scale-y:90%;--tw-scale-z:90%;scale:var(--tw-scale-x) var(--tw-scale-y)}.active\\:scale-\\[\\.96\\]:active{scale:.96}.active\\:bg-card2:active{background-color:var(--color-card2)}.data-\\[pressed\\=true\\]\\:bg-\\[rgba\\(255\\,255\\,255\\,0\\.06\\)\\][data-pressed=true]{background-color:#ffffff0f}}@property --tw-translate-x{syntax:"*";inherits:false;initial-value:0}@property --tw-translate-y{syntax:"*";inherits:false;initial-value:0}@property --tw-translate-z{syntax:"*";inherits:false;initial-value:0}@property --tw-rotate-x{syntax:"*";inherits:false}@property --tw-rotate-y{syntax:"*";inherits:false}@property --tw-rotate-z{syntax:"*";inherits:false}@property --tw-skew-x{syntax:"*";inherits:false}@property --tw-skew-y{syntax:"*";inherits:false}@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-leading{syntax:"*";inherits:false}@property --tw-font-weight{syntax:"*";inherits:false}@property --tw-tracking{syntax:"*";inherits:false}@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:"*";inherits:false}@property --tw-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:"*";inherits:false}@property --tw-inset-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:"*";inherits:false}@property --tw-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:"*";inherits:false}@property --tw-inset-ring-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:"*";inherits:false}@property --tw-ring-offset-width{syntax:"<length>";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:"*";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}@property --tw-outline-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-blur{syntax:"*";inherits:false}@property --tw-brightness{syntax:"*";inherits:false}@property --tw-contrast{syntax:"*";inherits:false}@property --tw-grayscale{syntax:"*";inherits:false}@property --tw-hue-rotate{syntax:"*";inherits:false}@property --tw-invert{syntax:"*";inherits:false}@property --tw-opacity{syntax:"*";inherits:false}@property --tw-saturate{syntax:"*";inherits:false}@property --tw-sepia{syntax:"*";inherits:false}@property --tw-drop-shadow{syntax:"*";inherits:false}@property --tw-drop-shadow-color{syntax:"*";inherits:false}@property --tw-drop-shadow-alpha{syntax:"<percentage>";inherits:false;initial-value:100%}@property --tw-drop-shadow-size{syntax:"*";inherits:false}@property --tw-backdrop-blur{syntax:"*";inherits:false}@property --tw-backdrop-brightness{syntax:"*";inherits:false}@property --tw-backdrop-contrast{syntax:"*";inherits:false}@property --tw-backdrop-grayscale{syntax:"*";inherits:false}@property --tw-backdrop-hue-rotate{syntax:"*";inherits:false}@property --tw-backdrop-invert{syntax:"*";inherits:false}@property --tw-backdrop-opacity{syntax:"*";inherits:false}@property --tw-backdrop-saturate{syntax:"*";inherits:false}@property --tw-backdrop-sepia{syntax:"*";inherits:false}@property --tw-scale-x{syntax:"*";inherits:false;initial-value:1}@property --tw-scale-y{syntax:"*";inherits:false;initial-value:1}@property --tw-scale-z{syntax:"*";inherits:false;initial-value:1}`;

  // src/tw.js
  var supportsAdopt = "adoptedStyleSheets" in Document.prototype && "replaceSync" in CSSStyleSheet.prototype;
  var twSheet;
  if (supportsAdopt) {
    const sheet = new CSSStyleSheet;
    sheet.replaceSync(TW_CSS.replace(/:root/g, ":host"));
    try {
      const doc = new CSSStyleSheet;
      let hoisted = 0;
      for (const rule of sheet.cssRules) {
        if (rule.constructor && rule.constructor.name === "CSSPropertyRule") {
          doc.insertRule(rule.cssText);
          hoisted++;
        }
      }
      if (hoisted)
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, doc];
    } catch (_e) {}
    twSheet = sheet;
  } else {
    twSheet = unsafeCSS(TW_CSS.replace(/:root/g, ":host"));
  }

  // src/hide-tabs.js
  var STYLE_ID = "fibbers-hide-tabs";
  var CSS = {
    true: `ha-tab-group { display: none !important; }`,
    header: `.header { display: none !important; }`
  };
  var state = {
    mode: false,
    observer: null,
    scheduled: false
  };
  function suppressed() {
    if (window.FIBBERS_SHOW_TABS === true)
      return true;
    try {
      return new URLSearchParams(window.location.search).has("disable_km");
    } catch (_) {
      return false;
    }
  }
  function findHuiRoot() {
    const stack = [document.documentElement];
    while (stack.length) {
      const el = stack.pop();
      if (el.localName === "hui-root")
        return el;
      if (el.shadowRoot)
        stack.push(...el.shadowRoot.children);
      if (el.children)
        stack.push(...el.children);
    }
    return null;
  }
  function findResolvedPanel() {
    const stack = [document.documentElement];
    while (stack.length) {
      const el = stack.pop();
      if (el.localName === "partial-panel-resolver")
        return el;
      if (el.shadowRoot)
        stack.push(...el.shadowRoot.children);
      if (el.children)
        stack.push(...el.children);
    }
    return null;
  }
  function paint() {
    if (!state.mode || suppressed())
      return removeStyle();
    const root = findHuiRoot();
    if (!root || !root.shadowRoot) {
      console.debug("fibbers: hui-root not found; leaving HA tabs untouched");
      return;
    }
    const css2 = CSS[state.mode];
    if (!css2)
      return;
    let style = root.shadowRoot.getElementById(STYLE_ID);
    if (style) {
      if (style.textContent !== css2)
        style.textContent = css2;
      return;
    }
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css2;
    root.shadowRoot.appendChild(style);
  }
  function removeStyle() {
    const root = findHuiRoot();
    const style = root && root.shadowRoot && root.shadowRoot.getElementById(STYLE_ID);
    if (style)
      style.remove();
  }
  function schedulePaint() {
    if (state.scheduled)
      return;
    state.scheduled = true;
    setTimeout(() => {
      state.scheduled = false;
      paint();
    }, 60);
  }
  function startObserver() {
    if (state.observer)
      return;
    const panel = findResolvedPanel() || document.body;
    try {
      state.observer = new MutationObserver(schedulePaint);
      state.observer.observe(panel, { childList: true, subtree: true });
    } catch (_) {}
  }
  function stopObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
  }
  function setTabHiding(mode) {
    const normalized = mode === true || mode === "header" ? mode : false;
    state.mode = normalized;
    if (!normalized) {
      removeTabHiding();
      return;
    }
    paint();
    startObserver();
  }
  function removeTabHiding() {
    state.mode = false;
    stopObserver();
    removeStyle();
  }
  window.addEventListener("location-changed", schedulePaint);
  window.addEventListener("popstate", schedulePaint);

  // src/icons.gen.js
  var ICONS = {
    "solar:add-circle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" opacity=".5"/><path d="M12.75 9C12.75 8.58579 12.4142 8.25 12 8.25C11.5858 8.25 11.25 8.58579 11.25 9L11.25 11.25H9C8.58579 11.25 8.25 11.5858 8.25 12C8.25 12.4142 8.58579 12.75 9 12.75H11.25V15C11.25 15.4142 11.5858 15.75 12 15.75C12.4142 15.75 12.75 15.4142 12.75 15L12.75 12.75H15C15.4142 12.75 15.75 12.4142 15.75 12C15.75 11.5858 15.4142 11.25 15 11.25H12.75V9Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:alarm-bold-duotone": {
      body: '<g fill="currentColor"><path d="M11.9998 21.9997C16.836 21.9997 20.7565 18.1159 20.7565 13.325C20.7565 8.53417 16.836 4.65039 11.9998 4.65039C7.16366 4.65039 3.24316 8.53417 3.24316 13.325C3.24316 18.1159 7.16366 21.9997 11.9998 21.9997Z" opacity=".5"/><path d="M11.9993 8.74707C12.4023 8.74707 12.729 9.07072 12.729 9.46996V13.0259L14.9477 15.2238C15.2326 15.5061 15.2326 15.9638 14.9477 16.2461C14.6627 16.5285 14.2006 16.5285 13.9157 16.2461L11.4833 13.8365C11.3464 13.701 11.2695 13.5171 11.2695 13.3254V9.46996C11.2695 9.07072 11.5962 8.74707 11.9993 8.74707Z"/><path fill-rule="evenodd" d="M8.2405 2.33986C8.45409 2.67841 8.3502 3.1244 8.00844 3.33599L4.11657 5.74562C3.77481 5.95722 3.32461 5.8543 3.11102 5.51574C2.89742 5.17718 3.00131 4.7312 3.34307 4.5196L7.23494 2.10998C7.5767 1.89838 8.0269 2.0013 8.2405 2.33986Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M15.7595 2.33985C15.9731 2.0013 16.4233 1.89838 16.7651 2.10998L20.6569 4.5196C20.9987 4.7312 21.1026 5.17719 20.889 5.51574C20.6754 5.8543 20.2252 5.95722 19.8834 5.74562L15.9916 3.33599C15.6498 3.1244 15.5459 2.67841 15.7595 2.33985Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:alt-arrow-down-bold-duotone": {
      body: '<g fill="currentColor"><path d="M8.30273 12.4044L11.6296 15.8351C11.8428 16.0549 12.1573 16.0549 12.3704 15.8351L18.8001 9.20467C19.2013 8.79094 18.9581 8 18.4297 8H12.7071L8.30273 12.4044Z"/><path d="M11.2929 8H5.5703C5.04189 8 4.79869 8.79094 5.1999 9.20467L7.60648 11.6864L11.2929 8Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:alt-arrow-left-bold-duotone": {
      body: '<g fill="currentColor"><path d="M11.5956 8.30273L8.16485 11.6296C7.94505 11.8428 7.94505 12.1573 8.16485 12.3704L14.7953 18.8001C15.2091 19.2013 16 18.9581 16 18.4297V12.7071L11.5956 8.30273Z"/><path d="M15.9999 11.2929L15.9999 5.5703C15.9999 5.04189 15.2089 4.79869 14.7952 5.1999L12.3135 7.60648L15.9999 11.2929Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:alt-arrow-right-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12.4044 8.30273L15.8351 11.6296C16.0549 11.8428 16.0549 12.1573 15.8351 12.3704L9.20467 18.8001C8.79094 19.2013 8 18.9581 8 18.4297V12.7071L12.4044 8.30273Z"/><path d="M8 11.2929L8 5.5703C8 5.04189 8.79094 4.79869 9.20467 5.1999L11.6864 7.60648L8 11.2929Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:alt-arrow-up-bold-duotone": {
      body: '<g fill="currentColor"><path d="M8.30273 11.5956L11.6296 8.16485C11.8428 7.94505 12.1573 7.94505 12.3704 8.16485L18.8001 14.7953C19.2013 15.2091 18.9581 16 18.4297 16H12.7071L8.30273 11.5956Z"/><path d="M11.2929 16.0009H5.5703C5.04189 16.0009 4.79869 15.2099 5.1999 14.7962L7.60648 12.3145L11.2929 16.0009Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:bath-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M2 11H1.75C1.33579 11 1 11.3358 1 11.75C1 12.1642 1.33579 12.5 1.75 12.5H2V12.75L2.00008 12.7614L2.00001 12.8168L2.00001 12.8546C2 13.2299 2 13.4498 2.01557 13.6952C2.15751 15.9316 3.36604 17.9968 5.11758 19.3472C5.27527 19.4726 6.0307 19.9348 6.3887 20.1501C7.19042 20.5559 8.0623 20.823 8.96911 20.9148C9.21355 20.9396 9.36275 20.9452 9.61687 20.9548L9.62369 20.955C10.3639 20.9828 11.0885 21 11.75 21C12.4115 21 13.1361 20.9828 13.8763 20.955L13.883 20.9548C14.1372 20.9452 14.2865 20.9396 14.5309 20.9148C15.4378 20.823 16.3098 20.5559 17.1116 20.15C17.45 19.9508 18.178 19.5114 18.3827 19.347C20.1341 17.9966 21.3425 15.9315 21.4845 13.6952C21.5 13.4498 21.5 13.2299 21.5 12.8546L21.5 12.8168C21.5 12.7567 21.5001 12.6942 21.4963 12.6365C21.4933 12.5905 21.4886 12.545 21.4821 12.5H21.75C22.1642 12.5 22.5 12.1642 22.5 11.75C22.5 11.3358 22.1642 11 21.75 11H3.5H2Z" clip-rule="evenodd"/><path d="M5.11758 19.3472C5.10383 19.3688 5.09106 19.3913 5.07934 19.4148L4.07934 21.4148C3.8941 21.7853 4.04427 22.2358 4.41475 22.421C4.78524 22.6062 5.23574 22.4561 5.42098 22.0856L6.3887 20.1502C6.0307 19.9348 5.27527 19.4727 5.11758 19.3472Z" opacity=".5"/><path d="M17.1113 20.1499L18.0791 22.0855C18.2643 22.456 18.7149 22.6062 19.0853 22.4209C19.4558 22.2357 19.606 21.7852 19.4207 21.4147L18.4207 19.4147C18.409 19.3912 18.3962 19.3686 18.3824 19.3469C18.1778 19.5113 17.4498 19.9508 17.1113 20.1499Z" opacity=".5"/><path d="M3.5 4.13516C3.5 3.23209 4.23209 2.5 5.13516 2.5C5.80379 2.5 6.40505 2.90708 6.65338 3.52788L6.79665 3.88607L8.15623 3.24613L8.04609 2.97079C7.56997 1.7805 6.41715 1 5.13516 1C3.40366 1 2 2.40366 2 4.13516V11H3.5V4.13516Z" opacity=".5"/><path d="M6.79601 3.88615C6.20149 4.31936 5.71579 4.92343 5.41658 5.66021C4.99627 6.69522 5.01894 7.80672 5.39716 8.76659C5.47156 8.95542 5.61933 9.10604 5.80671 9.18404C5.99408 9.26204 6.20508 9.26077 6.3915 9.18052L12.3523 6.61444C12.7244 6.45425 12.902 6.02752 12.7535 5.65061C12.3751 4.69037 11.6363 3.87197 10.621 3.43821C9.80968 3.0916 8.94888 3.04497 8.15558 3.24621L6.79601 3.88615Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:battery-low-bold-duotone": {
      body: '<g fill="currentColor"><path d="M3.17157 5.17157C2 6.34315 2 8.22876 2 12C2 15.7712 2 17.6569 3.17157 18.8284C4.34315 20 6.22876 20 10 20H11.5C15.2712 20 17.1569 20 18.3284 18.8284C19.5 17.6569 19.5 15.7712 19.5 12C19.5 8.22876 19.5 6.34315 18.3284 5.17157C17.1569 4 15.2712 4 11.5 4H10C6.22876 4 4.34315 4 3.17157 5.17157Z" opacity=".5"/><path d="M19.4912 14C19.4999 13.3993 19.4999 12.7355 19.4999 12C19.4999 11.2645 19.4999 10.6007 19.4912 10H19.9997C20.9425 10 21.4139 10 21.7068 10.2929C21.9997 10.5858 21.9997 11.0572 21.9997 12C21.9997 12.9428 21.9997 13.4142 21.7068 13.7071C21.4139 14 20.9425 14 19.9997 14H19.4912Z"/><path d="M6.6359 8.34452C6.99799 8.14336 7.45459 8.27382 7.65575 8.6359L7.00014 9.00014C7.65575 8.6359 7.65648 8.63722 7.65648 8.63722L7.65725 8.63861L7.65892 8.64166L7.66277 8.64877L7.6724 8.66712C7.67965 8.6812 7.68852 8.69895 7.69877 8.72046C7.71925 8.76349 7.7452 8.82149 7.77462 8.89503C7.83348 9.04219 7.90606 9.25113 7.97663 9.52635C8.1179 10.0773 8.25014 10.89 8.25014 12.0001C8.25014 13.1103 8.1179 13.923 7.97663 14.4739C7.90606 14.7491 7.83348 14.9581 7.77462 15.1052C7.7452 15.1788 7.71925 15.2368 7.69877 15.2798C7.68852 15.3013 7.67965 15.3191 7.6724 15.3331L7.66277 15.3515L7.65892 15.3586L7.65725 15.3617L7.65648 15.3631L7.65575 15.3644C7.45459 15.7265 6.99799 15.8569 6.6359 15.6558C6.27689 15.4563 6.14559 15.0057 6.33947 14.6451L6.34448 14.6349C6.35133 14.6205 6.36445 14.5918 6.3819 14.5482C6.41679 14.4609 6.46921 14.3136 6.52364 14.1014C6.63237 13.6773 6.75014 12.99 6.75014 12.0001C6.75014 11.0103 6.63237 10.323 6.52364 9.89892C6.46921 9.68664 6.41679 9.53933 6.3819 9.45212C6.36445 9.40848 6.35133 9.37976 6.34448 9.36536L6.33947 9.35513C6.14559 8.99455 6.27689 8.54397 6.6359 8.34452Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:bed-bold-duotone": {
      body: '<g fill="currentColor"><path d="M3.00244 12.2665C2.6221 12.4854 2.322 12.8248 2.15224 13.2346C2 13.6022 2 14.0681 2 15C2 15.9319 2 16.3978 2.15224 16.7654C2.35523 17.2554 2.74458 17.6448 3.23463 17.8478C3.48702 17.9523 3.78581 17.9851 4.25 17.9953V20C4.25 20.4142 4.58579 20.75 5 20.75C5.41421 20.75 5.75 20.4142 5.75 20V18H18.25V20C18.25 20.4142 18.5858 20.75 19 20.75C19.4142 20.75 19.75 20.4142 19.75 20V17.9953C20.2142 17.9851 20.513 17.9523 20.7654 17.8478C21.2554 17.6448 21.6448 17.2554 21.8478 16.7654C22 16.3978 22 15.9319 22 15C22 14.0681 22 13.6022 21.8478 13.2346C21.678 12.8248 21.3779 12.4854 20.9976 12.2666L19.25 12.0001L19 12H5L4.75003 12.0001L3.00244 12.2665Z"/><path d="M10.9976 4H12.9976C16.7688 4 18.6544 4 19.826 5.17157C20.8485 6.19404 20.9786 7.76038 20.9952 10.6494V12.2662L19.25 12.0001H4.75003L3.00244 12.2665L3 12.2679V10.6494C3.01656 7.76038 3.14669 6.19404 4.16916 5.17157C5.34073 4 7.22635 4 10.9976 4Z" opacity=".5"/><path d="M19 10.5C19 9.31352 18.9981 8.51653 18.919 7.92202C18.8435 7.35407 18.7129 7.11099 18.5543 6.9506C18.3956 6.79022 18.1552 6.65825 17.5934 6.58189C17.0054 6.50196 16.2171 6.5 15.0435 6.5H12.913V10.5L19 10.5Z"/><path d="M11.087 10.5V6.5H8.95652C7.78294 6.5 6.99461 6.50196 6.40656 6.58189C5.84479 6.65825 5.60435 6.79022 5.44571 6.9506C5.28706 7.11099 5.15653 7.35407 5.081 7.92202C5.00194 8.51653 5 9.31352 5 10.5L11.087 10.5Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:bolt-circle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12Z" opacity=".5"/><path d="M11.2274 8.56904L9.21236 10.1737C8.36695 10.8469 7.94424 11.1836 8.02675 11.5594L8.03114 11.578C8.12514 11.9515 8.66096 12.0951 9.73259 12.3823C10.3281 12.5418 10.6259 12.6216 10.7656 12.8473L10.7727 12.8592C10.9075 13.0876 10.8308 13.3737 10.6775 13.9459L10.6374 14.0954L10.6374 14.0954C10.2123 15.6818 9.99979 16.4749 10.4091 16.7311C10.8184 16.9872 11.4697 16.4686 12.7722 15.4314L12.7723 15.4314L14.7873 13.8267C15.6327 13.1535 16.0554 12.8169 15.9729 12.441L15.9686 12.4224C15.8745 12.0489 15.3387 11.9053 14.2671 11.6182C13.6716 11.4586 13.3738 11.3788 13.2341 11.1531L13.227 11.1412C13.0922 10.9128 13.1689 10.6267 13.3222 10.0546L13.3623 9.905C13.7873 8.31864 13.9999 7.52547 13.5905 7.26931C13.1812 7.01316 12.5299 7.53179 11.2274 8.56904Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:book-2-bold-duotone": {
      body: '<g fill="currentColor"><path d="M4.72718 2.73332C5.03258 2.42535 5.46135 2.22456 6.27103 2.11478C7.10452 2.00177 8.2092 2 9.7931 2H14.2069C15.7908 2 16.8955 2.00177 17.729 2.11478C18.5387 2.22456 18.9674 2.42535 19.2728 2.73332C19.5782 3.0413 19.7773 3.47368 19.8862 4.2902C19.9982 5.13073 20 6.24474 20 7.84202L20 18H7.42598C6.34236 18 5.96352 18.0057 5.67321 18.0681C5.15982 18.1785 4.71351 18.4151 4.38811 18.7347C4.27837 18.8425 4.22351 18.8964 4.09696 19.2397C4.02435 19.4367 4 19.5687 4 19.7003V7.84202C4 6.24474 4.00176 5.13073 4.11382 4.2902C4.22268 3.47368 4.42179 3.0413 4.72718 2.73332Z" opacity=".5"/><path d="M20 18H7.42598C6.34236 18 5.96352 18.0057 5.67321 18.0681C5.15982 18.1785 4.71351 18.4151 4.38811 18.7347C4.27837 18.8425 4.22351 18.8964 4.09696 19.2397C3.97041 19.5831 3.99045 19.7288 4.03053 20.02C4.03761 20.0714 4.04522 20.1216 4.05343 20.1706C4.16271 20.8228 4.36259 21.1682 4.66916 21.4142C4.97573 21.6602 5.40616 21.8206 6.21896 21.9083C7.05566 21.9986 8.1646 22 9.75461 22H14.1854C15.7754 22 16.8844 21.9986 17.7211 21.9083C18.5339 21.8206 18.9643 21.6602 19.2709 21.4142C19.4705 21.254 19.6249 21.0517 19.7385 20.75H8C7.58579 20.75 7.25 20.4142 7.25 20C7.25 19.5858 7.58579 19.25 8 19.25H19.9754C19.9926 18.8868 19.9982 18.4741 20 18Z"/><path d="M7.25 7C7.25 6.58579 7.58579 6.25 8 6.25H16C16.4142 6.25 16.75 6.58579 16.75 7C16.75 7.41421 16.4142 7.75 16 7.75H8C7.58579 7.75 7.25 7.41421 7.25 7Z"/><path d="M8 9.75C7.58579 9.75 7.25 10.0858 7.25 10.5C7.25 10.9142 7.58579 11.25 8 11.25H13C13.4142 11.25 13.75 10.9142 13.75 10.5C13.75 10.0858 13.4142 9.75 13 9.75H8Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:check-circle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" opacity=".5"/><path d="M16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:chef-hat-minimalistic-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 10C2 7.23858 4.23858 5 7 5C7.25052 5 7.49673 5.01842 7.73736 5.05399C8.33961 3.27806 10.0206 2 12 2C13.9794 2 15.6604 3.27806 16.2626 5.05399C16.5033 5.01842 16.7495 5 17 5C19.7614 5 22 7.23858 22 10C22 12.0503 20.7659 13.8124 19 14.584L19 18C19 19.8856 19 20.8284 18.4142 21.4142C17.8284 22 16.8856 22 15 22H9C7.11438 22 6.17157 22 5.58579 21.4142C5 20.8284 5 19.8856 5 18V14.584C3.2341 13.8124 2 12.0503 2 10Z" opacity=".5"/><path d="M9 17.25C8.58579 17.25 8.25 17.5858 8.25 18C8.25 18.4142 8.58579 18.75 9 18.75H15C15.4142 18.75 15.75 18.4142 15.75 18C15.75 17.5858 15.4142 17.25 15 17.25H9Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:clapperboard-play-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M2 12C2 10.7632 2 9.68872 2.02644 8.75H21.9736C22 9.68872 22 10.7632 22 12C22 16.714 22 19.071 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.071 2 16.714 2 12Z" clip-rule="evenodd" opacity=".5"/><path d="M15 14.5C15 13.8666 14.338 13.4395 13.014 12.5852C11.6719 11.7193 11.0008 11.2863 10.5004 11.6042C10 11.9221 10 12.7814 10 14.5C10 16.2186 10 17.0779 10.5004 17.3958C11.0008 17.7137 11.6719 17.2807 13.014 16.4148C14.338 15.5605 15 15.1334 15 14.5Z"/><path d="M11.9998 2C13.845 2 15.3291 2 16.5399 2.08783L13.0984 7.25002H8.40121L11.9012 2H11.9998Z"/><path d="M3.46429 3.46447C4.71666 2.2121 6.62176 2.03072 10.0955 2.00445L6.59844 7.25002H2.104C2.25125 5.48593 2.60663 4.32213 3.46429 3.46447Z"/><path d="M21.8956 7.25002C21.7484 5.48593 21.393 4.32213 20.5354 3.46447C19.938 2.86714 19.1922 2.51345 18.1985 2.30403L14.9012 7.25002H21.8956Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:clock-circle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" opacity=".5"/><path fill-rule="evenodd" d="M12 7.25C12.4142 7.25 12.75 7.58579 12.75 8V11.6893L15.0303 13.9697C15.3232 14.2626 15.3232 14.7374 15.0303 15.0303C14.7374 15.3232 14.2626 15.3232 13.9697 15.0303L11.4697 12.5303C11.329 12.3897 11.25 12.1989 11.25 12V8C11.25 7.58579 11.5858 7.25 12 7.25Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:cloud-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M22 14.3529C22 17.4717 19.4416 20 16.2857 20H10.4995C9.55792 18.7465 9 17.1884 9 15.5C9 11.3579 12.3579 8 16.5 8C17.009 8 17.5062 8.05071 17.9868 8.14736C18.0649 8.42841 18.1216 8.71822 18.1551 9.01498C20.393 9.78024 22 11.8811 22 14.3529Z" clip-rule="evenodd" opacity=".5"/><path d="M12.4762 4C9.32028 4 6.7619 6.52827 6.7619 9.64706C6.7619 10.3369 6.88706 10.9978 7.11616 11.6089C6.8475 11.5567 6.56983 11.5294 6.28571 11.5294C3.91878 11.5294 2 13.4256 2 15.7647C2 18.1038 3.91878 20 6.28571 20H10.4995C9.55792 18.7465 9 17.1884 9 15.5C9 11.3579 12.3579 8 16.5 8C17.009 8 17.5062 8.05071 17.9868 8.14736C17.9721 8.09441 17.9566 8.04178 17.9403 7.98948C17.2237 5.67956 15.0484 4 12.4762 4Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:cloud-rain-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M12.0303 14.9697C12.3232 15.2626 12.3232 15.7374 12.0303 16.0303L10.0303 18.0303C9.73744 18.3232 9.26256 18.3232 8.96967 18.0303C8.67678 17.7374 8.67678 17.2626 8.96967 16.9697L10.9697 14.9697C11.2626 14.6768 11.7374 14.6768 12.0303 14.9697ZM16.5303 14.9697C16.8232 15.2626 16.8232 15.7374 16.5303 16.0303L14.5303 18.0303C14.2374 18.3232 13.7626 18.3232 13.4697 18.0303C13.1768 17.7374 13.1768 17.2626 13.4697 16.9697L15.4697 14.9697C15.7626 14.6768 16.2374 14.6768 16.5303 14.9697ZM8.03033 18.4697C8.32322 18.7626 8.32322 19.2374 8.03033 19.5303L6.03033 21.5303C5.73744 21.8232 5.26256 21.8232 4.96967 21.5303C4.67678 21.2374 4.67678 20.7626 4.96967 20.4697L6.96967 18.4697C7.26256 18.1768 7.73744 18.1768 8.03033 18.4697ZM17.5303 18.4697C17.8232 18.7626 17.8232 19.2374 17.5303 19.5303L15.5303 21.5303C15.2374 21.8232 14.7626 21.8232 14.4697 21.5303C14.1768 21.2374 14.1768 20.7626 14.4697 20.4697L16.4697 18.4697C16.7626 18.1768 17.2374 18.1768 17.5303 18.4697ZM12.5303 19.4697C12.8232 19.7626 12.8232 20.2374 12.5303 20.5303L10.5303 22.5303C10.2374 22.8232 9.76256 22.8232 9.46967 22.5303C9.17678 22.2374 9.17678 21.7626 9.46967 21.4697L11.4697 19.4697C11.7626 19.1768 12.2374 19.1768 12.5303 19.4697Z" clip-rule="evenodd"/><path d="M12.0303 14.9697C12.3232 15.2626 12.3232 15.7374 12.0303 16.0303L10.0303 18.0303C9.91413 18.1465 9.7693 18.2166 9.61855 18.2406C9.3893 18.2771 9.14637 18.207 8.96967 18.0303C8.87927 17.9399 8.81677 17.8322 8.78218 17.7178C8.72864 17.5409 8.74191 17.348 8.82198 17.1789C8.85782 17.1032 8.90705 17.0323 8.96967 16.9697L10.9697 14.9697C11.2626 14.6768 11.7374 14.6768 12.0303 14.9697Z"/><path d="M15.4697 14.9697L13.4697 16.9697C13.1768 17.2626 13.1768 17.7374 13.4697 18.0303C13.7626 18.3232 14.2374 18.3232 14.5303 18.0303L16.5303 16.0303C16.8232 15.7374 16.8232 15.2626 16.5303 14.9697C16.2374 14.6768 15.7626 14.6768 15.4697 14.9697Z"/><path d="M16.2857 19C19.4416 19 22 16.4717 22 13.3529C22 10.8811 20.393 8.78024 18.1551 8.01498C17.8371 5.19371 15.4159 3 12.4762 3C9.32028 3 6.7619 5.52827 6.7619 8.64706C6.7619 9.33687 6.88706 9.9978 7.11616 10.6089C6.8475 10.5567 6.56983 10.5294 6.28571 10.5294C3.91878 10.5294 2 12.4256 2 14.7647C2 17.1038 3.91878 19 6.28571 19H16.2857Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:cloud-sun-bold-duotone": {
      body: '<g fill="currentColor"><circle cx="7" cy="7" r="5" opacity=".5"/><path d="M16.2857 20C19.4416 20 22 17.4717 22 14.3529C22 11.8811 20.393 9.78024 18.1551 9.01498C17.8371 6.19371 15.4159 4 12.4762 4C9.32028 4 6.7619 6.52827 6.7619 9.64706C6.7619 10.3369 6.88706 10.9978 7.11616 11.6089C6.8475 11.5567 6.56983 11.5294 6.28571 11.5294C3.91878 11.5294 2 13.4256 2 15.7647C2 18.1038 3.91878 20 6.28571 20H16.2857Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:cpu-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M12 3C12.3853 3 12.6977 3.31236 12.6977 3.69767V6.48884C13.2084 6.48991 13.6717 6.49342 14.0932 6.50495L14.093 6.48837V3.69767C14.093 3.31236 14.4054 3 14.7907 3C15.176 3 15.4884 3.31236 15.4884 3.69767V6.48837C15.4884 6.52487 15.4856 6.56072 15.4802 6.5957C16.4162 6.71067 17.0648 6.94879 17.558 7.44198C18.0512 7.93517 18.2893 8.58381 18.4043 9.51984C18.4393 9.51443 18.4751 9.51163 18.5116 9.51163H21.3023C21.6876 9.51163 22 9.82399 22 10.2093C22 10.5946 21.6876 10.907 21.3023 10.907H18.5116L18.495 10.9068C18.5066 11.3283 18.5106 11.7916 18.5116 12.3023H21.3023C21.6876 12.3023 22 12.6147 22 13C22 13.3853 21.6876 13.6977 21.3023 13.6977L18.5112 13.6977C18.5101 14.2084 18.5066 14.6717 18.495 15.0932L18.5116 15.093H21.3023C21.6876 15.093 22 15.4054 22 15.7907C22 16.176 21.6876 16.4884 21.3023 16.4884H18.5116C18.4751 16.4884 18.4393 16.4856 18.4043 16.4802C18.2893 17.4162 18.0512 18.0648 17.558 18.558C17.0648 19.0512 16.4162 19.2893 15.4802 19.4043C15.4856 19.4393 15.4884 19.4751 15.4884 19.5116V22.3023C15.4884 22.6876 15.176 23 14.7907 23C14.4054 23 14.093 22.6876 14.093 22.3023V19.5116L14.0932 19.495C13.6717 19.5066 13.2084 19.5106 12.6977 19.5116V22.3023C12.6977 22.6876 12.3853 23 12 23C11.6147 23 11.3023 22.6876 11.3023 22.3023L11.3023 19.5112C10.7916 19.5101 10.3283 19.5066 9.90678 19.495L9.90698 19.5116V22.3023C9.90698 22.6876 9.59462 23 9.2093 23C8.82399 23 8.51163 22.6876 8.51163 22.3023V19.5116C8.51163 19.4751 8.51443 19.4393 8.51984 19.4043C7.58381 19.2893 6.93517 19.0512 6.44198 18.558C5.94879 18.0648 5.71067 17.4162 5.5957 16.4802C5.56071 16.4856 5.52487 16.4884 5.48837 16.4884H2.69767C2.31236 16.4884 2 16.176 2 15.7907C2 15.4054 2.31236 15.093 2.69767 15.093H5.48837L5.50495 15.0932C5.49342 14.6717 5.48944 14.2084 5.48837 13.6977H2.69767C2.31236 13.6977 2 13.3853 2 13C2 12.6147 2.31236 12.3023 2.69767 12.3023L5.48884 12.3023C5.48991 11.7916 5.49342 11.3283 5.50495 10.9068L5.48837 10.907H2.69767C2.31236 10.907 2 10.5946 2 10.2093C2 9.82399 2.31236 9.51163 2.69767 9.51163H5.48837C5.52487 9.51163 5.56071 9.51443 5.5957 9.51984C5.71067 8.58381 5.94879 7.93517 6.44198 7.44198C6.93517 6.94879 7.58381 6.71067 8.51984 6.5957C8.51443 6.56072 8.51163 6.52487 8.51163 6.48837V3.69767C8.51163 3.31236 8.82399 3 9.2093 3C9.59462 3 9.90698 3.31236 9.90698 3.69767V6.48837L9.90678 6.50495C10.3283 6.49342 10.7916 6.48944 11.3023 6.48837V3.69767C11.3023 3.31236 11.6147 3 12 3ZM11.0238 8.5814C10.4054 8.58136 9.87247 8.58133 9.44573 8.63871C8.98839 8.70019 8.55001 8.83885 8.19443 9.19443C7.83885 9.55001 7.70019 9.98839 7.63871 10.4457C7.58133 10.8725 7.58136 11.4054 7.5814 12.0238V13.9762C7.58136 14.5946 7.58133 15.1275 7.63871 15.5543C7.70019 16.0116 7.83885 16.45 8.19443 16.8056C8.55001 17.1612 8.98839 17.2998 9.44573 17.3613C9.87247 17.4187 10.4054 17.4186 11.0238 17.4186H12.9762C13.5946 17.4186 14.1275 17.4187 14.5543 17.3613C15.0116 17.2998 15.45 17.1612 15.8056 16.8056C16.1612 16.45 16.2998 16.0116 16.3613 15.5543C16.4187 15.1275 16.4186 14.5946 16.4186 13.9762V12.0238C16.4186 11.4054 16.4187 10.8725 16.3613 10.4457C16.2998 9.98839 16.1612 9.55001 15.8056 9.19443C15.45 8.83885 15.0116 8.70019 14.5543 8.63871C14.1275 8.58133 13.5947 8.58136 12.9762 8.5814H11.0238Z" clip-rule="evenodd"/><path d="M9.18091 10.1809C9.23402 10.1278 9.32886 10.0621 9.63147 10.0214C9.95415 9.97804 10.3921 9.97656 11.0696 9.97656H12.9301C13.6075 9.97656 14.0455 9.97804 14.3682 10.0214C14.6708 10.0621 14.7656 10.1278 14.8187 10.1809C14.8718 10.234 14.9375 10.3289 14.9782 10.6315C15.0216 10.9542 15.0231 11.3921 15.0231 12.0696V13.9301C15.0231 14.6075 15.0216 15.0455 14.9782 15.3682C14.9375 15.6708 14.8718 15.7656 14.8187 15.8187C14.7656 15.8718 14.6708 15.9375 14.3682 15.9782C14.0455 16.0216 13.6075 16.0231 12.9301 16.0231H11.0696C10.3921 16.0231 9.95415 16.0216 9.63147 15.9782C9.32886 15.9375 9.23402 15.8718 9.18091 15.8187C9.1278 15.7656 9.06211 15.6708 9.02143 15.3682C8.97804 15.0455 8.97656 14.6075 8.97656 13.9301V12.0696C8.97656 11.3921 8.97804 10.9542 9.02143 10.6315C9.06211 10.3289 9.1278 10.234 9.18091 10.1809Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:danger-triangle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12 3C9.68925 3 8.23007 5.58716 5.31171 10.7615L4.94805 11.4063C2.52291 15.7061 1.31034 17.856 2.40626 19.428C3.50217 21 6.21356 21 11.6363 21H12.3637C17.7864 21 20.4978 21 21.5937 19.428C22.6897 17.856 21.4771 15.7061 19.0519 11.4063L18.6883 10.7615C15.7699 5.58716 14.3107 3 12 3Z" opacity=".5"/><path d="M12 7.25C12.4142 7.25 12.75 7.58579 12.75 8V13C12.75 13.4142 12.4142 13.75 12 13.75C11.5858 13.75 11.25 13.4142 11.25 13V8C11.25 7.58579 11.5858 7.25 12 7.25Z"/><path d="M12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:diskette-bold-duotone": {
      body: '<g fill="currentColor"><path d="M20.5355 20.5355C22 19.0711 22 16.714 22 12C22 11.6585 22 11.4878 21.9848 11.3142C21.9142 10.5049 21.586 9.71257 21.0637 9.09034C20.9516 8.95687 20.828 8.83317 20.5806 8.58578L15.4142 3.41944C15.1668 3.17206 15.0431 3.04835 14.9097 2.93631C14.2874 2.414 13.4951 2.08581 12.6858 2.01515C12.5122 2 12.3415 2 12 2C7.28595 2 4.92893 2 3.46447 3.46447C2 4.92893 2 7.28595 2 12C2 16.714 2 19.0711 3.46447 20.5355C4.1485 21.2196 5.02727 21.5841 6.25 21.7784L7.75 21.9313C8.9058 22 10.2996 22 12 22C13.7004 22 15.0942 22 16.25 21.9313L17.75 21.7784C18.9727 21.5841 19.8515 21.2196 20.5355 20.5355Z" opacity=".5"/><path d="M7 7.25C6.58579 7.25 6.25 7.58579 6.25 8C6.25 8.41421 6.58579 8.75 7 8.75H13C13.4142 8.75 13.75 8.41421 13.75 8C13.75 7.58579 13.4142 7.25 13 7.25H7Z"/><path d="M13.052 16.25C13.9505 16.25 14.6997 16.2499 15.2945 16.3299C15.9223 16.4143 16.4891 16.6 16.9445 17.0555C17.4 17.5109 17.5857 18.0777 17.6701 18.7055C17.7501 19.3003 17.75 20.0495 17.75 20.948V20.948L17.75 21.7812L16.25 21.9219V21C16.25 20.036 16.2484 19.3884 16.1835 18.9054C16.1214 18.4439 16.0142 18.2464 15.8839 18.1161C15.7536 17.9858 15.5561 17.8786 15.0946 17.8165C14.6116 17.7516 13.964 17.75 13 17.75H11C10.036 17.75 9.38843 17.7516 8.90539 17.8165C8.44393 17.8786 8.24644 17.9858 8.11612 18.1161C7.9858 18.2464 7.87858 18.4439 7.81654 18.9054C7.7516 19.3884 7.75 20.036 7.75 21V21.9258L6.25 21.7773L6.25 20.948V20.948C6.24997 20.0495 6.24995 19.3003 6.32991 18.7055C6.41432 18.0777 6.59999 17.5109 7.05546 17.0555C7.51093 16.6 8.07773 16.4143 8.70552 16.3299C9.3003 16.2499 10.0495 16.25 10.948 16.25H10.948H13.052H13.052Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:fire-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12.8324 21.8013C15.9583 21.1747 20 18.926 20 13.1112C20 7.8196 16.1267 4.29593 13.3415 2.67685C12.7235 2.31757 12 2.79006 12 3.50492V5.3334C12 6.77526 11.3938 9.40711 9.70932 10.5018C8.84932 11.0607 7.92052 10.2242 7.816 9.20388L7.73017 8.36604C7.6304 7.39203 6.63841 6.80075 5.85996 7.3946C4.46147 8.46144 3 10.3296 3 13.1112C3 20.2223 8.28889 22.0001 10.9333 22.0001C11.0871 22.0001 11.2488 21.9955 11.4171 21.9858C11.863 21.9296 11.4171 22.085 12.8324 21.8013Z" opacity=".5"/><path d="M8 18.4442C8 21.064 10.1113 21.8742 11.4171 21.9858C11.863 21.9296 11.4171 22.085 12.8324 21.8013C13.871 21.4343 15 20.4922 15 18.4442C15 17.1465 14.1814 16.3459 13.5401 15.9711C13.3439 15.8564 13.1161 16.0008 13.0985 16.2273C13.0429 16.9454 12.3534 17.5174 11.8836 16.9714C11.4685 16.4889 11.2941 15.784 11.2941 15.3331V14.7439C11.2941 14.3887 10.9365 14.1533 10.631 14.3346C9.49507 15.0085 8 16.3949 8 18.4442Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:home-2-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 12.2039C2 9.91549 2 8.77128 2.5192 7.82274C3.0384 6.87421 3.98695 6.28551 5.88403 5.10813L7.88403 3.86687C9.88939 2.62229 10.8921 2 12 2C13.1079 2 14.1106 2.62229 16.116 3.86687L18.116 5.10812C20.0131 6.28551 20.9616 6.87421 21.4808 7.82274C22 8.77128 22 9.91549 22 12.2039V13.725C22 17.6258 22 19.5763 20.8284 20.7881C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.7881C2 19.5763 2 17.6258 2 13.725V12.2039Z" opacity=".5"/><path d="M11.25 18C11.25 18.4142 11.5858 18.75 12 18.75C12.4142 18.75 12.75 18.4142 12.75 18V15C12.75 14.5858 12.4142 14.25 12 14.25C11.5858 14.25 11.25 14.5858 11.25 15V18Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:home-angle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M13.1061 22H10.8939C7.44737 22 5.72409 22 4.54903 20.9882C3.37396 19.9764 3.13025 18.2827 2.64284 14.8952L2.36407 12.9579C1.98463 10.3208 1.79491 9.00229 2.33537 7.87495C2.87583 6.7476 4.02619 6.06234 6.32691 4.69181L7.71175 3.86687C9.80104 2.62229 10.8457 2 12 2C13.1543 2 14.199 2.62229 16.2882 3.86687L17.6731 4.69181C19.9738 6.06234 21.1242 6.7476 21.6646 7.87495C22.2051 9.00229 22.0154 10.3208 21.6359 12.9579L21.3572 14.8952C20.8697 18.2827 20.626 19.9764 19.451 20.9882C18.2759 22 16.5526 22 13.1061 22Z" opacity=".5"/><path d="M8.25 18C8.25 17.5858 8.58579 17.25 9 17.25H15C15.4142 17.25 15.75 17.5858 15.75 18C15.75 18.4142 15.4142 18.75 15 18.75H9C8.58579 18.75 8.25 18.4142 8.25 18Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:lightbulb-bold-duotone": {
      body: '<g fill="currentColor"><path d="M4 9.67442C4 5.43595 7.35786 2 11.5 2C15.6421 2 19 5.43595 19 9.67442C19 11.9468 18.034 13.9892 16.5014 15.3934C15.9906 15.8614 15.6122 16.2082 15.344 16.4598C15.2099 16.5855 15.1074 16.6838 15.0317 16.7592C14.994 16.7968 14.9651 16.8266 14.9436 16.8496C14.933 16.861 14.925 16.8699 14.9192 16.8766L14.914 16.8826L14.9108 16.8864C14.6743 17.1851 14.6231 17.2622 14.5926 17.332C14.5621 17.4018 14.5402 17.4922 14.4805 17.8717C14.457 18.0216 14.4545 18.2782 14.4545 18.9767V19.0067C14.4546 19.4158 14.4546 19.7687 14.4289 20.0583C14.4018 20.3645 14.3418 20.6677 14.1805 20.9535C14.001 21.2717 13.7428 21.5359 13.4318 21.7196C13.1525 21.8846 12.8562 21.946 12.557 21.9738C12.274 22 11.9292 22 11.5294 22H11.5293H11.4707H11.4706C11.0708 22 10.726 22 10.443 21.9738C10.1438 21.946 9.84747 21.8846 9.56818 21.7196C9.25723 21.5359 8.99902 21.2717 8.81949 20.9535C8.65825 20.6677 8.5982 20.3645 8.57107 20.0583C8.54543 19.7687 8.54544 19.4158 8.54545 19.0067L8.54545 18.9767C8.54545 18.2782 8.54305 18.0216 8.51949 17.8717C8.45982 17.4922 8.43787 17.4018 8.40739 17.332C8.3769 17.2622 8.32571 17.1851 8.0892 16.8864L8.08591 16.8825L8.0808 16.8766C8.07499 16.8699 8.06699 16.861 8.05635 16.8496C8.03486 16.8266 8.00601 16.7968 7.9683 16.7592C7.89262 16.6838 7.7901 16.5855 7.65601 16.4598C7.38782 16.2082 7.0094 15.8614 6.49859 15.3934C4.96602 13.9892 4 11.9468 4 9.67442Z" opacity=".5"/><path d="M10.2978 13.6246C10.0904 13.266 9.63156 13.1435 9.27302 13.3509C8.91447 13.5583 8.79195 14.0171 8.99936 14.3757C9.35263 14.9864 9.93556 15.4498 10.631 15.6465V17.0001C10.631 17.4143 10.9668 17.7501 11.381 17.7501C11.7952 17.7501 12.131 17.4143 12.131 17.0001V15.6466C12.8264 15.4498 13.4094 14.9864 13.7626 14.3757C13.97 14.0171 13.8475 13.5583 13.489 13.3509C13.1304 13.1435 12.6716 13.266 12.4642 13.6246C12.247 14.0002 11.8427 14.2501 11.381 14.2501C10.9193 14.2501 10.515 14.0002 10.2978 13.6246Z"/><path d="M9.91421 19.6745H13.0843C13.0814 19.7715 13.0769 19.8562 13.0701 19.9325C13.0516 20.1419 13.0203 20.2179 12.9988 20.2559C12.939 20.362 12.8529 20.4501 12.7493 20.5113C12.7121 20.5333 12.6378 20.5653 12.4331 20.5843C12.2191 20.6041 11.9366 20.6048 11.4993 20.6048C11.0619 20.6048 10.7795 20.6041 10.5654 20.5843C10.3607 20.5653 10.2864 20.5333 10.2493 20.5113C10.1456 20.4501 10.0595 20.362 9.99971 20.2559C9.97826 20.2179 9.94697 20.1419 9.92842 19.9325C9.92166 19.8562 9.91718 19.7715 9.91421 19.6745Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:lightbulb-bolt-bold-duotone": {
      body: '<g fill="currentColor"><path d="M4 9.67442C4 5.43595 7.35786 2 11.5 2C15.6421 2 19 5.43595 19 9.67442C19 11.9468 18.034 13.9892 16.5014 15.3934C15.9906 15.8614 15.6122 16.2082 15.344 16.4598C15.2099 16.5855 15.1074 16.6838 15.0317 16.7592C14.994 16.7968 14.9651 16.8266 14.9436 16.8496C14.933 16.861 14.925 16.8699 14.9192 16.8766C14.9133 16.8834 14.9108 16.8864 14.9108 16.8864C14.6743 17.1851 14.6231 17.2622 14.5926 17.332C14.5621 17.4018 14.5402 17.4922 14.4805 17.8717C14.457 18.0216 14.4545 18.2782 14.4545 18.9767V19.0067C14.4546 19.4158 14.4546 19.7687 14.4289 20.0583C14.4018 20.3645 14.3418 20.6677 14.1805 20.9535C14.001 21.2717 13.7428 21.5359 13.4318 21.7196C13.1525 21.8846 12.8562 21.946 12.557 21.9738C12.274 22 11.9292 22 11.5294 22H11.5293H11.4707H11.4706C11.0708 22 10.726 22 10.443 21.9738C10.1438 21.946 9.84747 21.8846 9.56818 21.7196C9.25723 21.5359 8.99902 21.2717 8.81949 20.9535C8.65825 20.6677 8.5982 20.3645 8.57107 20.0583C8.54543 19.7687 8.54544 19.4158 8.54545 19.0067L8.54545 18.9767C8.54545 18.2782 8.54305 18.0216 8.51949 17.8717C8.45982 17.4922 8.43787 17.4018 8.40739 17.332C8.3769 17.2622 8.32571 17.1851 8.0892 16.8864C8.0892 16.8864 8.08649 16.8831 8.0808 16.8766C8.07499 16.8699 8.06699 16.861 8.05635 16.8496C8.03486 16.8266 8.00601 16.7968 7.9683 16.7592C7.89262 16.6838 7.7901 16.5855 7.65601 16.4598C7.38782 16.2082 7.0094 15.8614 6.49859 15.3934C4.96602 13.9892 4 11.9468 4 9.67442Z" opacity=".5"/><path d="M13.0848 19.6748H9.91463C9.9176 19.7718 9.92209 19.8565 9.92884 19.9327C9.94739 20.1422 9.97868 20.2182 10.0001 20.2562C10.06 20.3623 10.146 20.4504 10.2497 20.5116C10.2868 20.5335 10.3612 20.5656 10.5658 20.5845C10.7799 20.6044 11.0623 20.6051 11.4997 20.6051C11.9371 20.6051 12.2195 20.6044 12.4336 20.5845C12.6382 20.5656 12.7125 20.5335 12.7497 20.5116C12.8533 20.4504 12.9394 20.3623 12.9993 20.2562C13.0207 20.2182 13.052 20.1422 13.0706 19.9327C13.0773 19.8565 13.0818 19.7718 13.0848 19.6748Z"/><path d="M12.6102 8.17688C12.9166 8.40084 12.9875 8.83658 12.7687 9.15012L11.5907 10.8376H12.9931C13.2485 10.8376 13.4825 10.9837 13.5993 11.2161C13.7162 11.4484 13.6963 11.7282 13.5479 11.9408L11.5998 14.7315C11.381 15.0451 10.9551 15.1177 10.6487 14.8937C10.3423 14.6698 10.2713 14.234 10.4902 13.9205L11.6682 12.233H10.2658C10.0104 12.233 9.77642 12.0869 9.65955 11.8545C9.54269 11.6222 9.56254 11.3424 9.71099 11.1298L11.659 8.33909C11.8779 8.02555 12.3037 7.95292 12.6102 8.17688Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:menu-dots-bold-duotone": {
      body: '<g fill="currentColor"><path d="M7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12Z"/><path d="M21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12Z"/><path d="M14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:minus-circle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" opacity=".5"/><path d="M15.75 12C15.75 12.4142 15.4142 12.75 15 12.75H9C8.58579 12.75 8.25 12.4142 8.25 12C8.25 11.5858 8.58579 11.25 9 11.25H15C15.4142 11.25 15.75 11.5858 15.75 12Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:moon-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M22 12.0004C22 17.5232 17.5228 22.0004 12 22.0004C10.8358 22.0004 9.71801 21.8014 8.67887 21.4357C8.24138 20.3772 8 19.217 8 18.0004C8 15.7792 8.80467 13.7459 10.1384 12.1762C11.31 13.8818 13.2744 15.0004 15.5 15.0004C17.8615 15.0004 19.9289 13.741 21.0672 11.8572C21.3065 11.4612 22 11.5377 22 12.0004Z" clip-rule="evenodd" opacity=".5"/><path d="M2 12C2 16.3586 4.78852 20.0659 8.67887 21.4353C8.24138 20.3768 8 19.2166 8 18C8 15.7788 8.80467 13.7455 10.1384 12.1758C9.42027 11.1303 9 9.86422 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:moon-stars-bold-duotone": {
      body: '<g fill="currentColor"><path d="M19.9001 2.30719C19.7392 1.8976 19.1616 1.8976 19.0007 2.30719L18.5703 3.40247C18.5212 3.52752 18.4226 3.62651 18.298 3.67583L17.2067 4.1078C16.7986 4.26934 16.7986 4.849 17.2067 5.01054L18.298 5.44252C18.4226 5.49184 18.5212 5.59082 18.5703 5.71587L19.0007 6.81115C19.1616 7.22074 19.7392 7.22074 19.9001 6.81116L20.3305 5.71587C20.3796 5.59082 20.4782 5.49184 20.6028 5.44252L21.6941 5.01054C22.1022 4.849 22.1022 4.26934 21.6941 4.1078L20.6028 3.67583C20.4782 3.62651 20.3796 3.52752 20.3305 3.40247L19.9001 2.30719Z"/><path d="M16.0328 8.12967C15.8718 7.72009 15.2943 7.72009 15.1333 8.12967L14.9764 8.52902C14.9273 8.65407 14.8287 8.75305 14.7041 8.80237L14.3062 8.95987C13.8981 9.12141 13.8981 9.70107 14.3062 9.86261L14.7041 10.0201C14.8287 10.0694 14.9273 10.1684 14.9764 10.2935L15.1333 10.6928C15.2943 11.1024 15.8718 11.1024 16.0328 10.6928L16.1897 10.2935C16.2388 10.1684 16.3374 10.0694 16.462 10.0201L16.8599 9.86261C17.268 9.70107 17.268 9.12141 16.8599 8.95987L16.462 8.80237C16.3374 8.75305 16.2388 8.65407 16.1897 8.52902L16.0328 8.12967Z"/><path d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:music-note-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M10.0905 11.9629L19.3632 8.63087L20.9996 7.95235V7.49236C20.9996 6.37238 20.9996 5.4331 20.9118 4.68472C20.8994 4.57895 20.8848 4.4738 20.8686 4.37569C20.7841 3.86441 20.6348 3.38745 20.3465 2.98917C20.2024 2.79002 20.0235 2.61055 19.8007 2.45628C19.7589 2.42736 19.7156 2.39932 19.6707 2.3722L19.6617 2.36679C18.8901 1.90553 18.0228 1.93852 17.1293 2.14305C16.2652 2.34086 15.194 2.74368 13.8803 3.23763L11.5959 4.09656C10.9801 4.32806 10.4584 4.52419 10.049 4.72734C9.61332 4.94348 9.23805 5.1984 8.95662 5.57828C8.67519 5.95817 8.55831 6.36756 8.50457 6.81203C8.45406 7.22978 8.45408 7.7378 8.4541 8.33743V12.6016L10.0905 11.9629Z" clip-rule="evenodd"/><g opacity=".5"><path d="M8.45455 16.1305C7.90347 15.8136 7.24835 15.6298 6.54545 15.6298C4.58735 15.6298 3 17.0558 3 18.8148C3 20.5738 4.58735 21.9998 6.54545 21.9998C8.50355 21.9998 10.0909 20.5738 10.0909 18.8148L10.0909 11.9627L8.45455 12.6014V16.1305Z"/><path d="M19.3636 8.63067V14.1705C18.8126 13.8536 18.1574 13.6698 17.4545 13.6698C15.4964 13.6698 13.9091 15.0958 13.9091 16.8548C13.9091 18.6138 15.4964 20.0398 17.4545 20.0398C19.4126 20.0398 21 18.6138 21 16.8548L21 7.95215L19.3636 8.63067Z"/></g></g>',
      vb: "0 0 24 24"
    },
    "solar:muted-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M17 16C15.1144 16 14.1716 16 13.5858 15.4142C13 14.8284 13 13.8856 13 12C13 10.1144 13 9.17157 13.5858 8.58579C14.1716 8 15.1144 8 17 8C18.8856 8 19.8284 8 20.4142 8.58579C21 9.17157 21 10.1144 21 12C21 13.8856 21 14.8284 20.4142 15.4142C19.8284 16 18.8856 16 17 16ZM15.6936 9.75082C15.4333 9.49047 15.0112 9.49047 14.7508 9.75082C14.4905 10.0112 14.4905 10.4333 14.7508 10.6936L16.0572 12L14.7508 13.3064C14.4905 13.5667 14.4905 13.9888 14.7508 14.2492C15.0112 14.5095 15.4333 14.5095 15.6936 14.2492L17 12.9428L18.3064 14.2492C18.5667 14.5095 18.9888 14.5095 19.2492 14.2492C19.5095 13.9888 19.5095 13.5667 19.2492 13.3064L17.9428 12L19.2492 10.6936C19.5095 10.4333 19.5095 10.0112 19.2492 9.75082C18.9888 9.49047 18.5667 9.49047 18.3064 9.75082L17 11.0572L15.6936 9.75082Z" clip-rule="evenodd"/><path d="M3.00304 11.7155C3.04093 9.87326 3.05988 8.95215 3.68099 8.16363C3.79436 8.0197 3.9607 7.8487 4.10011 7.73274C4.86393 7.09741 5.8724 7.09741 7.88932 7.09741C8.60991 7.09741 8.97021 7.09741 9.31366 7.00452C9.38503 6.98522 9.45565 6.96296 9.52534 6.93781C9.86075 6.81675 10.1616 6.60837 10.7632 6.19162C13.137 4.54739 14.3239 3.72526 15.3201 4.0824C15.5111 4.15088 15.6959 4.24972 15.861 4.37162C16.5687 4.89405 16.739 5.98595 16.8499 8.00001C15.0639 8.00042 14.1558 8.01576 13.5858 8.58579C13 9.17157 13 10.1144 13 12C13 13.8856 13 14.8284 13.5858 15.4142C14.1558 15.9842 15.0639 15.9996 16.8499 16C16.739 18.0141 16.5687 19.1059 15.861 19.6284C15.6959 19.7503 15.5111 19.8491 15.3201 19.9176C14.3239 20.2747 13.137 19.4526 10.7632 17.8084C10.1616 17.3916 9.86075 17.1833 9.52534 17.0622C9.45565 17.037 9.38503 17.0148 9.31366 16.9955C8.97021 16.9026 8.60991 16.9026 7.88932 16.9026C5.8724 16.9026 4.86393 16.9026 4.10011 16.2673C3.9607 16.1513 3.79436 15.9803 3.68099 15.8364C3.05988 15.0478 3.04093 14.1267 3.00304 12.2845C3.00104 12.1878 3 12.0928 3 12C3 11.9072 3.00104 11.8122 3.00304 11.7155Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:palette-bold-duotone": {
      body: '<g fill="currentColor"><path d="M7.75 19C7.75 19.4142 7.41421 19.75 7 19.75H5C4.58579 19.75 4.25 19.4142 4.25 19C4.25 18.5858 4.58579 18.25 5 18.25H7C7.41421 18.25 7.75 18.5858 7.75 19Z"/><path d="M10 18V6C10 4.59987 10 3.8998 9.72752 3.36502C9.48783 2.89462 9.10538 2.51217 8.63498 2.27248C8.1002 2 7.40013 2 6 2C4.59987 2 3.8998 2 3.36502 2.27248C2.89462 2.51217 2.51217 2.89462 2.27248 3.36502C2 3.8998 2 4.59987 2 6V18C2 19.4001 2 20.1002 2.27248 20.635C2.51217 21.1054 2.89462 21.4878 3.36502 21.7275C3.8998 22 4.59987 22 6 22C7.40013 22 8.1002 22 8.63498 21.7275C9.10538 21.4878 9.48783 21.1054 9.72752 20.635C10 20.1002 10 19.4001 10 18Z" opacity=".5"/><g opacity=".5"><path d="M10 8.24276V18C10 18.9186 10 19.5359 9.92304 20.0029L13.2219 16.7041L19.0599 10.6145C20.0332 9.6111 20.5199 9.10939 20.6964 8.53425C20.847 8.04375 20.843 7.5188 20.685 7.03065C20.4997 6.45826 19.9999 5.95847 19.0003 4.95892C18.0991 4.07259 17.6484 3.62942 17.1204 3.44458C16.6857 3.29244 16.2175 3.2633 15.7673 3.36039C15.2204 3.47834 14.7183 3.86221 13.7141 4.62996L13 5.24276L10 8.24276Z"/><path d="M8.00288 21.923C8.00192 21.9232 8.00096 21.9234 8 21.9235V21.9259L8.00288 21.923Z"/></g><g opacity=".5"><path d="M10 8.24276V18C10 18.9186 10 19.5359 9.92304 20.0029L13.2219 16.7041L19.0599 10.6145C20.0332 9.6111 20.5199 9.10939 20.6964 8.53425C20.847 8.04375 20.843 7.5188 20.685 7.03065C20.4997 6.45826 19.9999 5.95847 19.0003 4.95892C18.0991 4.07259 17.6484 3.62942 17.1204 3.44458C16.6857 3.29244 16.2175 3.2633 15.7673 3.36039C15.2204 3.47834 14.7183 3.86221 13.7141 4.62996L13 5.24276L10 8.24276Z"/><path d="M8.00288 21.923C8.00192 21.9232 8.00096 21.9234 8 21.9235V21.9259L8.00288 21.923Z"/></g><path d="M15.8143 14H17.8994C19.2995 14 19.9996 14 20.5344 14.2725C21.0048 14.5122 21.3872 14.8946 21.6269 15.365C21.8994 15.8998 21.8994 16.5999 21.8994 18C21.8994 19.4001 21.8994 20.1002 21.6269 20.635C21.3872 21.1054 21.0048 21.4878 20.5344 21.7275C19.9996 22 19.2995 22 17.8994 22H6C6.91721 22 7.53399 22 8.00069 21.9234L8 21.9259L8.00288 21.923C8.24762 21.8827 8.45107 21.8212 8.63498 21.7275C9.10538 21.4878 9.48783 21.1054 9.72752 20.635C9.82122 20.4511 9.8827 20.2476 9.92304 20.0029L13.2219 16.7041L15.8143 14Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:pause-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 6C2 4.11438 2 3.17157 2.58579 2.58579C3.17157 2 4.11438 2 6 2C7.88562 2 8.82843 2 9.41421 2.58579C10 3.17157 10 4.11438 10 6V18C10 19.8856 10 20.8284 9.41421 21.4142C8.82843 22 7.88562 22 6 22C4.11438 22 3.17157 22 2.58579 21.4142C2 20.8284 2 19.8856 2 18V6Z"/><path d="M14 6C14 4.11438 14 3.17157 14.5858 2.58579C15.1716 2 16.1144 2 18 2C19.8856 2 20.8284 2 21.4142 2.58579C22 3.17157 22 4.11438 22 6V18C22 19.8856 22 20.8284 21.4142 21.4142C20.8284 22 19.8856 22 18 22C16.1144 22 15.1716 22 14.5858 21.4142C14 20.8284 14 19.8856 14 18V6Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:play-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M23 12C23 10.9648 22.4695 9.92953 21.4086 9.35258L8.59661 2.38548C6.53435 1.26402 4 2.72368 4 5.0329L4 12H23Z" clip-rule="evenodd"/><path d="M8.59662 21.6145L21.4086 14.6474C22.4695 14.0705 23 13.0352 23 12H4L4 18.9671C4 21.2763 6.53435 22.736 8.59662 21.6145Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:power-bold-duotone": {
      body: '<g fill="currentColor"><path d="M8.7919 5.14712C9.17345 4.98591 9.35208 4.54591 9.19087 4.16435C9.02966 3.7828 8.58966 3.60417 8.2081 3.76538C4.70832 5.24406 2.25 8.70925 2.25 12.7503C2.25 18.1351 6.61522 22.5003 12 22.5003C17.3848 22.5003 21.75 18.1351 21.75 12.7503C21.75 8.70925 19.2917 5.24406 15.7919 3.76538C15.4103 3.60417 14.9703 3.7828 14.8091 4.16435C14.6479 4.54591 14.8265 4.98591 15.2081 5.14712C18.1722 6.39947 20.25 9.33312 20.25 12.7503C20.25 17.3067 16.5563 21.0003 12 21.0003C7.44365 21.0003 3.75 17.3067 3.75 12.7503C3.75 9.33312 5.82779 6.39947 8.7919 5.14712Z" opacity=".5"/><path d="M12.75 2.75C12.75 2.33579 12.4142 2 12 2C11.5858 2 11.25 2.33579 11.25 2.75V6.75C11.25 7.16421 11.5858 7.5 12 7.5C12.4142 7.5 12.75 7.16421 12.75 6.75V2.75Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:record-circle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" opacity=".5"/><path fill-rule="evenodd" d="M12.75 12C12.75 12.6443 12.9375 13.2449 13.2609 13.75H10.7391C11.0625 13.2449 11.25 12.6443 11.25 12C11.25 10.2051 9.79493 8.75 8 8.75C6.20507 8.75 4.75 10.2051 4.75 12C4.75 13.7949 6.20507 15.25 8 15.25H16C17.7949 15.25 19.25 13.7949 19.25 12C19.25 10.2051 17.7949 8.75 16 8.75C14.2051 8.75 12.75 10.2051 12.75 12ZM14.25 12C14.25 11.0335 15.0335 10.25 16 10.25C16.9665 10.25 17.75 11.0335 17.75 12C17.75 12.9665 16.9665 13.75 16 13.75C15.0335 13.75 14.25 12.9665 14.25 12ZM9.75 12C9.75 12.9665 8.9665 13.75 8 13.75C7.0335 13.75 6.25 12.9665 6.25 12C6.25 11.0335 7.0335 10.25 8 10.25C8.9665 10.25 9.75 11.0335 9.75 12Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:skip-next-bold-duotone": {
      body: '<g fill="currentColor"><path d="M22.75 5C22.75 4.58579 22.4142 4.25 22 4.25C21.5858 4.25 21.25 4.58579 21.25 5V19C21.25 19.4142 21.5858 19.75 22 19.75C22.4142 19.75 22.75 19.4142 22.75 19V5Z" opacity=".5"/><path d="M16.6598 14.6474C18.4467 13.4935 18.4467 10.5065 16.6598 9.35258L5.87083 2.38548C4.13419 1.26402 2 2.72368 2 5.0329V18.9671C2 21.2763 4.13419 22.736 5.87083 21.6145L16.6598 14.6474Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:skip-previous-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 5C2 4.58579 2.33579 4.25 2.75 4.25C3.16421 4.25 3.5 4.58579 3.5 5V19C3.5 19.4142 3.16421 19.75 2.75 19.75C2.33579 19.75 2 19.4142 2 19V5Z" opacity=".5"/><path d="M8.09015 14.6474C6.30328 13.4935 6.30328 10.5065 8.09016 9.35258L18.8792 2.38548C20.6158 1.26402 22.75 2.72368 22.75 5.0329V18.9671C22.75 21.2763 20.6158 22.736 18.8792 21.6145L8.09015 14.6474Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:snowflake-bold-duotone": {
      body: '<g fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"><path d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V4.18934L14.4697 2.46967C14.7626 2.17678 15.2374 2.17678 15.5303 2.46967C15.8232 2.76256 15.8232 3.23744 15.5303 3.53033L12.75 6.31066V17.6893L15.5303 20.4697C15.8232 20.7626 15.8232 21.2374 15.5303 21.5303C15.2374 21.8232 14.7626 21.8232 14.4697 21.5303L12.75 19.8107V22C12.75 22.4142 12.4142 22.75 12 22.75C11.5858 22.75 11.25 22.4142 11.25 22V19.8107L9.53033 21.5303C9.23744 21.8232 8.76256 21.8232 8.46967 21.5303C8.17678 21.2374 8.17678 20.7626 8.46967 20.4697L11.25 17.6893V6.31066L8.46967 3.53033C8.17678 3.23744 8.17678 2.76256 8.46967 2.46967C8.76256 2.17678 9.23744 2.17678 9.53033 2.46967L11.25 4.18934V2C11.25 1.58579 11.5858 1.25 12 1.25Z"/><path d="M5.51135 4.17809C5.91145 4.07088 6.3227 4.30832 6.4299 4.70842L7.44758 8.50642L11.9996 11.1345L16.5516 8.50642L17.5693 4.70842C17.6765 4.30832 18.0877 4.07088 18.4878 4.17809C18.8879 4.28529 19.1254 4.69654 19.0182 5.09664L18.3887 7.44576L20.2847 6.35109C20.6435 6.14398 21.1022 6.26689 21.3093 6.62561C21.5164 6.98433 21.3935 7.44302 21.0347 7.65013L19.1387 8.7448L21.4878 9.37424C21.8879 9.48144 22.1254 9.8927 22.0182 10.2928C21.911 10.6929 21.4997 10.9303 21.0996 10.8231L17.3016 9.80546L13.4996 12.0005L17.3018 14.1958L21.0998 13.1781C21.4999 13.0709 21.9112 13.3083 22.0184 13.7084C22.1256 14.1085 21.8881 14.5198 21.488 14.627L19.1389 15.2564L21.0349 16.3511C21.3937 16.5582 21.5166 17.0169 21.3095 17.3756C21.1024 17.7343 20.6437 17.8572 20.2849 17.6501L18.3889 16.5555L19.0184 18.9046C19.1256 19.3047 18.8881 19.7159 18.488 19.8231C18.0879 19.9303 17.6767 19.6929 17.5695 19.2928L16.5518 15.4948L11.9996 12.8666L7.44738 15.4948L6.42971 19.2928C6.3225 19.6929 5.91125 19.9303 5.51115 19.8231C5.11105 19.7159 4.87361 19.3047 4.98082 18.9046L5.61026 16.5555L3.71424 17.6501C3.35552 17.8572 2.89683 17.7343 2.68972 17.3756C2.48261 17.0169 2.60552 16.5582 2.96424 16.3511L4.86026 15.2564L2.51115 14.627C2.11105 14.5198 1.87361 14.1085 1.98082 13.7084C2.08803 13.3083 2.49928 13.0709 2.89938 13.1781L6.69738 14.1958L10.4996 12.0005L6.69758 9.80546L2.89957 10.8231C2.49948 10.9303 2.08822 10.6929 1.98102 10.2928C1.87381 9.8927 2.11125 9.48144 2.51135 9.37424L4.86046 8.7448L2.96443 7.65013C2.60572 7.44302 2.48281 6.98433 2.68992 6.62561C2.89702 6.26689 3.35572 6.14398 3.71443 6.35109L5.61046 7.44576L4.98102 5.09664C4.87381 4.69654 5.11125 4.28529 5.51135 4.17809Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:socket-bold-duotone": {
      body: '<g fill="currentColor"><path d="M3.46447 3.46447C2 4.92893 2 7.28595 2 12C2 16.714 2 19.0711 3.46447 20.5355C4.92893 22 7.28595 22 12 22C16.714 22 19.0711 22 20.5355 20.5355C22 19.0711 22 16.714 22 12C22 7.28595 22 4.92893 20.5355 3.46447C19.0711 2 16.714 2 12 2C7.28595 2 4.92893 2 3.46447 3.46447Z" opacity=".5"/><path fill-rule="evenodd" d="M11.25 7.49982V6.80299V5.29102C7.87504 5.6641 5.25 8.5254 5.25 11.9998C5.25 15.4742 7.87504 18.3355 11.25 18.7086V17.1967V16.4998C11.25 16.0855 11.5858 15.7498 12 15.7498C12.4142 15.7498 12.75 16.0855 12.75 16.4998V17.1967V18.7086C16.125 18.3355 18.75 15.4742 18.75 11.9998C18.75 8.5254 16.125 5.6641 12.75 5.29102V6.80299V7.49982C12.75 7.91403 12.4142 8.24982 12 8.24982C11.5858 8.24982 11.25 7.91403 11.25 7.49982ZM15 11.9998C15 12.5521 14.5523 12.9998 14 12.9998C13.4477 12.9998 13 12.5521 13 11.9998C13 11.4475 13.4477 10.9998 14 10.9998C14.5523 10.9998 15 11.4475 15 11.9998ZM10 12.9998C10.5523 12.9998 11 12.5521 11 11.9998C11 11.4475 10.5523 10.9998 10 10.9998C9.44772 10.9998 9 11.4475 9 11.9998C9 12.5521 9.44772 12.9998 10 12.9998Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:sofa-2-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12.75 14H17.2C17.6418 14 18 13.6418 18 13.2V12C18 10.8954 18.8954 10 20 10C21.1046 10 22 10.8954 22 12V14.4444C22 15.5284 21.5149 16.4991 20.75 17.1513V19C20.75 19.4142 20.4142 19.75 20 19.75C19.5858 19.75 19.25 19.4142 19.25 19V17.9084C18.9912 17.9683 18.7215 18 18.4444 18H5.55556C5.27849 18 5.00883 17.9683 4.75 17.9084V19C4.75 19.4142 4.41421 19.75 4 19.75C3.58579 19.75 3.25 19.4142 3.25 19V17.1513C2.48508 16.4991 2 15.5284 2 14.4444V12C2 10.8954 2.89543 10 4 10C5.10457 10 6 10.8954 6 12V13.2C6 13.6418 6.35817 14 6.8 14H11.25V5H12.75V14Z"/><g opacity=".5"><path d="M17.2 14H12.75V5H15C15.9293 5 16.394 5 16.7804 5.07686C18.3671 5.39249 19.6075 6.63288 19.9231 8.21964C19.9657 8.43379 19.9847 8.67199 19.9932 9.00001L20 9V10C18.8954 10 18 10.8954 18 12V13.2C18 13.6418 17.6418 14 17.2 14Z"/><path d="M11.25 14H6.8C6.35817 14 6 13.6418 6 13.2V12C6 10.8977 5.10825 10.0037 4.00681 10V9.00001C4.01527 8.67199 4.03426 8.43379 4.07686 8.21964C4.39249 6.63288 5.63288 5.39249 7.21964 5.07686C7.60603 5 8.07069 5 9 5H11.25V14Z"/></g></g>',
      vb: "0 0 24 24"
    },
    "solar:speaker-bold-duotone": {
      body: '<g fill="currentColor"><path d="M4 10C4 6.22876 4 4.34315 5.17157 3.17157C6.34315 2 8.22876 2 12 2C15.7712 2 17.6569 2 18.8284 3.17157C20 4.34315 20 6.22876 20 10V14C20 17.7712 20 19.6569 18.8284 20.8284C17.6569 22 15.7712 22 12 22C8.22876 22 6.34315 22 5.17157 20.8284C4 19.6569 4 17.7712 4 14V10Z" opacity=".5"/><path fill-rule="evenodd" d="M12 4.75C10.4812 4.75 9.25 5.98122 9.25 7.5C9.25 9.01878 10.4812 10.25 12 10.25C13.5188 10.25 14.75 9.01878 14.75 7.5C14.75 5.98122 13.5188 4.75 12 4.75Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M8.25 15.5C8.25 13.4289 9.92893 11.75 12 11.75C14.0711 11.75 15.75 13.4289 15.75 15.5C15.75 17.5711 14.0711 19.25 12 19.25C9.92893 19.25 8.25 17.5711 8.25 15.5Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:ssd-round-bold-duotone": {
      body: '<g fill="currentColor"><path d="M5.49965 13.5882H18.4996C19.8107 13.5882 20.9534 14.3515 21.553 15.4813L18.9996 5.11765C18.4996 3.52941 17.6042 3 16.4996 3H7.49965C6.39508 3 5.49965 3.52941 4.99965 5.11765L2.44629 15.4813C3.04588 14.3515 4.18858 13.5882 5.49965 13.5882Z" opacity=".5"/><path fill-rule="evenodd" d="M18.5 13.5879H5.5C4.18893 13.5879 3.04623 14.3512 2.44664 15.4809C2.16221 16.0169 2 16.6353 2 17.2938C2 19.3405 3.567 20.9997 5.5 20.9997H18.5C20.433 20.9997 22 19.3405 22 17.2938C22 16.6353 21.8378 16.0169 21.5534 15.4809C20.9538 14.3512 19.8111 13.5879 18.5 13.5879ZM18 16.25C18.4142 16.25 18.75 16.5858 18.75 17V18C18.75 18.4142 18.4142 18.75 18 18.75C17.5858 18.75 17.25 18.4142 17.25 18V17C17.25 16.5858 17.5858 16.25 18 16.25ZM16.25 17C16.25 16.5858 15.9142 16.25 15.5 16.25C15.0858 16.25 14.75 16.5858 14.75 17V18C14.75 18.4142 15.0858 18.75 15.5 18.75C15.9142 18.75 16.25 18.4142 16.25 18V17ZM13 16.25C13.4142 16.25 13.75 16.5858 13.75 17V18C13.75 18.4142 13.4142 18.75 13 18.75C12.5858 18.75 12.25 18.4142 12.25 18V17C12.25 16.5858 12.5858 16.25 13 16.25ZM11.25 17C11.25 16.5858 10.9142 16.25 10.5 16.25C10.0858 16.25 9.75 16.5858 9.75 17V18C9.75 18.4142 10.0858 18.75 10.5 18.75C10.9142 18.75 11.25 18.4142 11.25 18V17Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:ssd-square-bold-duotone": {
      body: '<g fill="currentColor"><path d="M16.4997 3H7.49974C6.39517 3 5.49974 3.52941 4.99974 5.11765L2.15711 14.9263C2.20259 14.7794 2.26122 14.6491 2.3368 14.5294C2.48272 14.2982 2.67022 14.0996 2.8886 13.9451C3.39305 13.5882 4.09528 13.5882 5.49974 13.5882H18.4997C19.9042 13.5882 20.6064 13.5882 21.1109 13.9451C21.3293 14.0996 21.5168 14.2982 21.6627 14.5294C21.7432 14.6571 21.8046 14.7968 21.8513 14.9557L18.9997 5.11765C18.4997 3.52941 17.6043 3 16.4997 3Z" opacity=".5"/><path fill-rule="evenodd" d="M5.5 13.5879H18.5C19.9045 13.5879 20.6067 13.5879 21.1111 13.9448C21.3295 14.0993 21.517 14.2978 21.6629 14.529C21.7435 14.6567 21.8049 14.7965 21.8515 14.9554C22 15.4611 22 16.1618 22 17.2929C22 18.7799 22 19.5244 21.6629 20.0585C21.517 20.2897 21.3295 20.4883 21.1111 20.6428C20.6067 20.9997 19.9045 20.9997 18.5 20.9997H5.5C4.09554 20.9997 3.39331 20.9997 2.88886 20.6428C2.67048 20.4883 2.48298 20.2897 2.33706 20.0585C2 19.5244 2 18.7809 2 17.2938C2 16.1949 2 15.502 2.136 14.9997C2.14278 14.9746 2.1499 14.95 2.15737 14.9259C2.20285 14.7791 2.26148 14.6488 2.33706 14.529C2.48298 14.2978 2.67048 14.0993 2.88886 13.9448C3.39331 13.5879 4.09554 13.5879 5.5 13.5879ZM19 16.25C19.4142 16.25 19.75 16.5858 19.75 17V18C19.75 18.4142 19.4142 18.75 19 18.75C18.5858 18.75 18.25 18.4142 18.25 18V17C18.25 16.5858 18.5858 16.25 19 16.25ZM17.25 17C17.25 16.5858 16.9142 16.25 16.5 16.25C16.0858 16.25 15.75 16.5858 15.75 17V18C15.75 18.4142 16.0858 18.75 16.5 18.75C16.9142 18.75 17.25 18.4142 17.25 18V17ZM14 16.25C14.4142 16.25 14.75 16.5858 14.75 17V18C14.75 18.4142 14.4142 18.75 14 18.75C13.5858 18.75 13.25 18.4142 13.25 18V17C13.25 16.5858 13.5858 16.25 14 16.25ZM12.25 17C12.25 16.5858 11.9142 16.25 11.5 16.25C11.0858 16.25 10.75 16.5858 10.75 17V18C10.75 18.4142 11.0858 18.75 11.5 18.75C11.9142 18.75 12.25 18.4142 12.25 18V17Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:star-fall-bold-duotone": {
      body: '<g fill="currentColor"><path d="M10.2768 16.5148C10.2815 16.405 10.4634 16.3613 10.5174 16.4571C10.7707 16.9068 11.2029 17.5682 11.6932 17.8689C12.1836 18.1696 12.969 18.2549 13.4847 18.2768C13.5945 18.2815 13.6381 18.4634 13.5423 18.5174C13.0926 18.7707 12.4313 19.2029 12.1306 19.6932C11.8299 20.1836 11.7446 20.969 11.7227 21.4847C11.718 21.5945 11.536 21.6381 11.4821 21.5423C11.2287 21.0926 10.7966 20.4313 10.3062 20.1306C9.81588 19.8299 9.03048 19.7446 8.51481 19.7227C8.40495 19.718 8.36133 19.536 8.45713 19.4821C8.90682 19.2287 9.56818 18.7966 9.86889 18.3062C10.1696 17.8159 10.2549 17.0305 10.2768 16.5148Z"/><path d="M18.4919 15.5147C18.4834 15.4051 18.2916 15.3591 18.2343 15.453C18.062 15.7355 17.8135 16.0764 17.5374 16.2458C17.2612 16.4152 16.8446 16.482 16.5147 16.5075C16.4051 16.516 16.3591 16.7078 16.453 16.7651C16.7355 16.9374 17.0764 17.1858 17.2458 17.462C17.4152 17.7382 17.482 18.1548 17.5075 18.4847C17.516 18.5943 17.7078 18.6403 17.7651 18.5464C17.9374 18.2639 18.1858 17.923 18.462 17.7536C18.7382 17.5842 19.1548 17.5174 19.4847 17.4919C19.5943 17.4834 19.6403 17.2916 19.5464 17.2343C19.2639 17.062 18.923 16.8135 18.7536 16.5374C18.5842 16.2612 18.5174 15.8446 18.4919 15.5147Z" opacity=".5"/><path d="M14.7034 4.00181L14.4611 3.69574C13.5245 2.51266 13.0561 1.92112 12.5113 2.00845C11.9665 2.09577 11.7059 2.80412 11.1849 4.22083L11.0501 4.58735C10.902 4.98993 10.828 5.19122 10.686 5.33897C10.544 5.48671 10.3501 5.56417 9.96242 5.71911L9.60942 5.86016L9.36156 5.95933C8.16204 6.4406 7.55761 6.71331 7.48044 7.24324C7.39813 7.80849 7.97023 8.29205 9.11443 9.25915L9.41045 9.50935C9.7356 9.78417 9.89817 9.92158 9.99137 10.1089C10.0846 10.2962 10.0978 10.5121 10.1244 10.9441L10.1485 11.3373C10.2419 12.8574 10.2886 13.6174 10.7826 13.8794C11.2765 14.1414 11.8906 13.7319 13.1188 12.9129L13.1188 12.9129L13.4366 12.701C13.7856 12.4683 13.9601 12.3519 14.1597 12.32C14.3593 12.288 14.5613 12.344 14.9655 12.456L15.3334 12.558C16.7555 12.9522 17.4666 13.1493 17.8542 12.746C18.2418 12.3427 18.0493 11.6061 17.6641 10.1328L17.5645 9.75163C17.4551 9.33297 17.4003 9.12364 17.4305 8.91657C17.4606 8.70951 17.5723 8.52816 17.7955 8.16546L17.7955 8.16544L17.9987 7.83522C18.7843 6.55883 19.1771 5.92063 18.9227 5.40935C18.6682 4.89806 17.9351 4.85229 16.4689 4.76076L16.0896 4.73708C15.6729 4.71107 15.4646 4.69807 15.2836 4.60208C15.1027 4.5061 14.9696 4.338 14.7034 4.00181L14.7034 4.00181Z"/><path d="M8.835 13.326C6.69772 14.3702 4.91931 16.024 4.24844 18.0002C3.49589 13.2926 4.53976 10.2526 6.21308 8.36328C6.35728 8.658 6.54466 8.902 6.71297 9.09269C7.06286 9.48911 7.56518 9.91347 8.07523 10.3444L8.44225 10.6545C8.51184 10.7134 8.56597 10.7592 8.61197 10.7989C8.61665 10.8632 8.62129 10.9383 8.62727 11.0357L8.65708 11.5212C8.69717 12.1761 8.7363 12.8155 8.835 13.326Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:sun-bold-duotone": {
      body: '<g fill="currentColor"><path d="M18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12Z"/><path fill-rule="evenodd" d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V3C12.75 3.41421 12.4142 3.75 12 3.75C11.5858 3.75 11.25 3.41421 11.25 3V2C11.25 1.58579 11.5858 1.25 12 1.25ZM1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H3C3.41421 11.25 3.75 11.5858 3.75 12C3.75 12.4142 3.41421 12.75 3 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12ZM20.25 12C20.25 11.5858 20.5858 11.25 21 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H21C20.5858 12.75 20.25 12.4142 20.25 12ZM12 20.25C12.4142 20.25 12.75 20.5858 12.75 21V22C12.75 22.4142 12.4142 22.75 12 22.75C11.5858 22.75 11.25 22.4142 11.25 22V21C11.25 20.5858 11.5858 20.25 12 20.25Z" clip-rule="evenodd"/><g opacity=".5"><path d="M4.39838 4.39838C4.69127 4.10549 5.16615 4.10549 5.45904 4.39838L5.85188 4.79122C6.14477 5.08411 6.14477 5.55898 5.85188 5.85188C5.55898 6.14477 5.08411 6.14477 4.79122 5.85188L4.39838 5.45904C4.10549 5.16615 4.10549 4.69127 4.39838 4.39838Z"/><path d="M19.6009 4.39864C19.8938 4.69153 19.8938 5.16641 19.6009 5.4593L19.2081 5.85214C18.9152 6.14503 18.4403 6.14503 18.1474 5.85214C17.8545 5.55924 17.8545 5.08437 18.1474 4.79148L18.5402 4.39864C18.8331 4.10575 19.308 4.10575 19.6009 4.39864Z"/><path d="M18.1474 18.1474C18.4403 17.8545 18.9152 17.8545 19.2081 18.1474L19.6009 18.5402C19.8938 18.8331 19.8938 19.308 19.6009 19.6009C19.308 19.8938 18.8331 19.8938 18.5402 19.6009L18.1474 19.2081C17.8545 18.9152 17.8545 18.4403 18.1474 18.1474Z"/><path d="M5.85188 18.1477C6.14477 18.4406 6.14477 18.9154 5.85188 19.2083L5.45904 19.6012C5.16615 19.8941 4.69127 19.8941 4.39838 19.6012C4.10549 19.3083 4.10549 18.8334 4.39838 18.5405L4.79122 18.1477C5.08411 17.8548 5.55898 17.8548 5.85188 18.1477Z"/></g></g>',
      vb: "0 0 24 24"
    },
    "solar:sunrise-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M7.25 22C7.25 21.5858 7.58579 21.25 8 21.25H16C16.4142 21.25 16.75 21.5858 16.75 22C16.75 22.4142 16.4142 22.75 16 22.75H8C7.58579 22.75 7.25 22.4142 7.25 22Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V3C12.75 3.41421 12.4142 3.75 12 3.75C11.5858 3.75 11.25 3.41421 11.25 3V2C11.25 1.58579 11.5858 1.25 12 1.25ZM1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H3C3.41421 11.25 3.75 11.5858 3.75 12C3.75 12.4142 3.41421 12.75 3 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12ZM20.25 12C20.25 11.5858 20.5858 11.25 21 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H21C20.5858 12.75 20.25 12.4142 20.25 12Z" clip-rule="evenodd"/><path d="M5.25 12C5.25 13.1778 5.5521 14.2858 6.08267 15.25H2C1.58579 15.25 1.25 15.5858 1.25 16C1.25 16.4142 1.58579 16.75 2 16.75H11.25V11.8107L10.5303 12.5303C10.2374 12.8232 9.76256 12.8232 9.46967 12.5303C9.17678 12.2374 9.17678 11.7626 9.46967 11.4697L11.4697 9.46967C11.7626 9.17678 12.2374 9.17678 12.5303 9.46967L14.5303 11.4697C14.8232 11.7626 14.8232 12.2374 14.5303 12.5303C14.2374 12.8232 13.7626 12.8232 13.4697 12.5303L12.75 11.8107V16.75H22C22.4142 16.75 22.75 16.4142 22.75 16C22.75 15.5858 22.4142 15.25 22 15.25H17.9173C18.4479 14.2858 18.75 13.1778 18.75 12C18.75 8.27208 15.7279 5.25 12 5.25C8.27208 5.25 5.25 8.27208 5.25 12Z" opacity=".5"/><path d="M12.5303 9.46967C12.2374 9.17678 11.7626 9.17678 11.4697 9.46967L9.46967 11.4697C9.17678 11.7626 9.17678 12.2374 9.46967 12.5303C9.76256 12.8232 10.2374 12.8232 10.5303 12.5303L11.25 11.8107V16.75H12.75V11.8107L13.4697 12.5303C13.7626 12.8232 14.2374 12.8232 14.5303 12.5303C14.8232 12.2374 14.8232 11.7626 14.5303 11.4697L12.5303 9.46967Z"/><path d="M4.25 19C4.25 18.5858 4.58579 18.25 5 18.25H19C19.4142 18.25 19.75 18.5858 19.75 19C19.75 19.4142 19.4142 19.75 19 19.75H5C4.58579 19.75 4.25 19.4142 4.25 19Z"/><g opacity=".5"><path d="M4.39838 4.39838C4.69127 4.10549 5.16615 4.10549 5.45904 4.39838L5.85188 4.79122C6.14477 5.08411 6.14477 5.55898 5.85188 5.85188C5.55898 6.14477 5.08411 6.14477 4.79122 5.85188L4.39838 5.45904C4.10549 5.16615 4.10549 4.69127 4.39838 4.39838Z"/><path d="M19.6009 4.39864C19.8938 4.69153 19.8938 5.16641 19.6009 5.4593L19.2081 5.85214C18.9152 6.14503 18.4403 6.14503 18.1474 5.85214C17.8545 5.55924 17.8545 5.08437 18.1474 4.79148L18.5402 4.39864C18.8331 4.10575 19.308 4.10575 19.6009 4.39864Z"/></g></g>',
      vb: "0 0 24 24"
    },
    "solar:tea-cup-bold-duotone": {
      body: '<g fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"><path d="M2.2509 11.8809C2.2404 12.057 2.26536 12.2706 2.3153 12.6978L2.71598 16.1258C2.89681 17.6729 3.72352 19.0714 4.99182 19.9757C5.9263 20.6419 7.04537 21 8.19303 21H11.8069C12.9546 21 14.0736 20.6419 15.0081 19.9757C15.8116 19.4028 16.4378 18.6317 16.8349 17.75H19C21.0711 17.75 22.75 16.0711 22.75 14C22.75 11.9289 21.0711 10.25 19 10.25H16.7212C16.5325 10.1455 16.3244 10.0703 16.1027 10.0309C15.929 10 15.7139 10 15.2838 10H4.71612C4.286 10 4.07094 10 3.89725 10.0309C2.98677 10.1928 2.30599 10.9577 2.2509 11.8809ZM17.7369 11.75C17.7424 11.7932 17.7464 11.8369 17.749 11.8809C17.7595 12.057 17.7346 12.2706 17.6847 12.6977L17.284 16.1258C17.2791 16.1673 17.2738 16.2087 17.268 16.25H19C20.2426 16.25 21.25 15.2426 21.25 14C21.25 12.7574 20.2426 11.75 19 11.75H17.7369Z"/><g opacity=".5"><path d="M10.5307 1.46967C10.8236 1.76256 10.8236 2.23744 10.5307 2.53033C10.2713 2.78972 10.2713 3.21028 10.5307 3.46967C11.3758 4.31485 11.3758 5.68515 10.5307 6.53033C10.2378 6.82322 9.7629 6.82322 9.47001 6.53033C9.17712 6.23744 9.17712 5.76256 9.47001 5.46967C9.7294 5.21028 9.7294 4.78972 9.47001 4.53033C8.62483 3.68515 8.62483 2.31485 9.47001 1.46967C9.7629 1.17678 10.2378 1.17678 10.5307 1.46967Z"/><path d="M6.03052 2.96967C6.32341 3.26256 6.32341 3.73744 6.03052 4.03033L5.9144 4.14645C5.67115 4.3897 5.64379 4.77479 5.85019 5.05C6.50448 5.92239 6.41772 7.14313 5.64664 7.91421L5.53052 8.03033C5.23763 8.32322 4.76275 8.32322 4.46986 8.03033C4.17697 7.73744 4.17697 7.26256 4.46986 6.96967L4.58598 6.85355C4.82923 6.6103 4.85659 6.22521 4.65019 5.95C3.9959 5.07761 4.08266 3.85687 4.85374 3.08579L4.96986 2.96967C5.26275 2.67678 5.73763 2.67678 6.03052 2.96967Z"/><path d="M15.5305 2.96967C15.8234 3.26256 15.8234 3.73744 15.5305 4.03033L15.4144 4.14645C15.1712 4.3897 15.1438 4.77479 15.3502 5.05C16.0045 5.92239 15.9177 7.14313 15.1466 7.91421L15.0305 8.03033C14.7376 8.32322 14.2628 8.32322 13.9699 8.03033C13.677 7.73744 13.677 7.26256 13.9699 6.96967L14.086 6.85355C14.3292 6.6103 14.3566 6.22521 14.1502 5.95C13.4959 5.07761 13.5827 3.85687 14.3537 3.08579L14.4699 2.96967C14.7628 2.67678 15.2376 2.67678 15.5305 2.96967Z"/></g></g>',
      vb: "0 0 24 24"
    },
    "solar:temperature-bold-duotone": {
      body: '<g fill="currentColor"><path d="M17.5 16.5C17.5 19.5376 15.0376 22 12 22C8.96243 22 6.5 19.5376 6.5 16.5C6.5 14.7636 7.30465 13.2152 8.56141 12.2072C8.82505 11.9957 9 11.6857 9 11.3477V5C9 3.34315 10.3431 2 12 2C13.6569 2 15 3.34315 15 5V11.3477C15 11.6857 15.1749 11.9957 15.4386 12.2072C16.6954 13.2152 17.5 14.7636 17.5 16.5Z" opacity=".5"/><path d="M12.75 5C12.75 4.58579 12.4142 4.25 12 4.25C11.5858 4.25 11.25 4.58579 11.25 5V13.3804C11.25 13.8172 10.9527 14.1876 10.592 14.4339C9.93273 14.8841 9.5 15.6415 9.5 16.5C9.5 17.8807 10.6193 19 12 19C13.3807 19 14.5 17.8807 14.5 16.5C14.5 15.6415 14.0673 14.8841 13.408 14.4339C13.0473 14.1876 12.75 13.8172 12.75 13.3804V5Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:tv-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M16 6H13.4163H10.5837H8C5.17157 6 3.75736 6 2.87868 6.87868C2 7.75736 2 9.17157 2 12V16C2 18.8284 2 20.2426 2.87868 21.1213C3.75736 22 5.17157 22 8 22L16 22V6Z" clip-rule="evenodd"/><path d="M22 11.9998V15.9998C22 18.8282 22 20.2424 21.1213 21.1211C20.296 21.9464 18.9983 21.9966 16.5 21.9996H16V6H16.5C18.9983 6.00305 20.296 6.05318 21.1213 6.87848C22 7.75716 22 9.17138 22 11.9998Z" opacity=".5"/><path d="M13.4163 6.00011L15.5695 3.48811C15.839 3.17361 15.8026 2.70014 15.4881 2.43057C15.1736 2.161 14.7001 2.19743 14.4306 2.51192L12 5.34757L9.56946 2.51192C9.29989 2.19743 8.82641 2.16101 8.51192 2.43057C8.19743 2.70014 8.161 3.17361 8.43057 3.48811L10.5837 6.00011H13.4163Z" opacity=".5"/><path d="M19 11C19.5523 11 20 11.4477 20 12C20 12.5523 19.5523 13 19 13C18.4477 13 18 12.5523 18 12C18 11.4477 18.4477 11 19 11Z"/><path d="M19 15C19.5523 15 20 15.4477 20 16C20 16.5523 19.5523 17 19 17C18.4477 17 18 16.5523 18 16C18 15.4477 18.4477 15 19 15Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:user-bold-duotone": {
      body: '<g fill="currentColor"><circle cx="12" cy="6" r="4"/><path d="M20 17.5C20 19.9853 20 22 12 22C4 22 4 19.9853 4 17.5C4 15.0147 7.58172 13 12 13C16.4183 13 20 15.0147 20 17.5Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:volume-loud-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2.00299 11.7155C2.04033 9.87326 2.059 8.95215 2.67093 8.16363C2.78262 8.0197 2.9465 7.8487 3.08385 7.73274C3.83639 7.09741 4.82995 7.09741 6.81706 7.09741C7.527 7.09741 7.88197 7.09741 8.22035 7.00452C8.29067 6.98522 8.36024 6.96296 8.4289 6.93781C8.75936 6.81674 9.05574 6.60837 9.64851 6.19161C11.9872 4.54738 13.1565 3.72527 14.138 4.08241C14.3261 4.15088 14.5083 4.24972 14.671 4.37162C15.5194 5.00744 15.5839 6.48675 15.7128 9.44537C15.7606 10.5409 15.7931 11.4785 15.7931 12C15.7931 12.5215 15.7606 13.4591 15.7128 14.5546C15.5839 17.5132 15.5194 18.9926 14.671 19.6284C14.5083 19.7503 14.3261 19.8491 14.138 19.9176C13.1565 20.2747 11.9872 19.4526 9.64851 17.8084C9.05574 17.3916 8.75936 17.1833 8.4289 17.0622C8.36024 17.037 8.29067 17.0148 8.22035 16.9955C7.88197 16.9026 7.52701 16.9026 6.81706 16.9026C4.82995 16.9026 3.83639 16.9026 3.08385 16.2673C2.9465 16.1513 2.78262 15.9803 2.67093 15.8364C2.059 15.0478 2.04033 14.1267 2.00299 12.2845C2.00103 12.1878 2 12.0928 2 12C2 11.9072 2.00103 11.8122 2.00299 11.7155Z"/><path fill-rule="evenodd" d="M17.7572 8.41592C18.0902 8.21868 18.51 8.34659 18.695 8.70163L18.0921 9.05876C18.695 8.70163 18.695 8.70163 18.695 8.70163L18.6957 8.70291L18.6964 8.70428L18.6979 8.70727L18.7014 8.71425L18.7103 8.73224C18.717 8.74604 18.7251 8.76345 18.7345 8.78454C18.7534 8.82672 18.7772 8.88359 18.8043 8.95571C18.8584 9.1 18.9252 9.30487 18.9901 9.57473C19.12 10.1149 19.2415 10.9118 19.2415 12.0003C19.2415 13.0888 19.12 13.8857 18.9901 14.4259C18.9252 14.6958 18.8584 14.9006 18.8043 15.0449C18.7772 15.117 18.7534 15.1739 18.7345 15.2161C18.7251 15.2372 18.717 15.2546 18.7103 15.2684L18.7014 15.2864L18.6979 15.2934L18.6964 15.2963L18.6957 15.2977C18.6957 15.2977 18.695 15.299 18.0921 14.9419L18.695 15.299C18.51 15.654 18.0902 15.782 17.7572 15.5847C17.4271 15.3891 17.3063 14.9474 17.4846 14.5938L17.4892 14.5838C17.4955 14.5696 17.5076 14.5415 17.5236 14.4987C17.5557 14.4132 17.6039 14.2687 17.654 14.0606C17.754 13.6448 17.8622 12.9709 17.8622 12.0003C17.8622 11.0297 17.754 10.3558 17.654 9.94003C17.6039 9.73189 17.5557 9.58745 17.5236 9.50194C17.5076 9.45915 17.4955 9.43099 17.4892 9.41687L17.4846 9.40684C17.3063 9.05328 17.4271 8.61149 17.7572 8.41592Z" clip-rule="evenodd" opacity=".5"/><path d="M20.5049 12.0001C20.5049 9.99167 20.1465 8.58305 19.8047 7.69442C19.6335 7.2492 19.4651 6.93143 19.3457 6.7325C19.2861 6.6332 19.2388 6.56321 19.209 6.52156L19.1787 6.48055L19.1328 6.41902C18.9201 6.10395 18.9762 5.67259 19.2744 5.42391C19.5926 5.15879 20.0659 5.20158 20.3311 5.51961L19.8369 5.93172C20.3311 5.51997 20.3318 5.52027 20.3321 5.52059L20.3369 5.52645C20.3391 5.52903 20.341 5.53276 20.3438 5.53621C20.3495 5.54328 20.357 5.55189 20.3653 5.56258C20.3819 5.58412 20.4037 5.61303 20.4297 5.64949C20.482 5.72263 20.5519 5.82617 20.6328 5.96102C20.7947 6.23083 21.0014 6.62664 21.2051 7.15633C21.6133 8.2177 22.0049 9.80885 22.0049 12.0001C22.0049 14.1913 21.6133 15.7825 21.2051 16.8438C21.0014 17.3735 20.7947 17.7693 20.6328 18.0391C20.5519 18.174 20.482 18.2775 20.4297 18.3507C20.4037 18.3871 20.3819 18.416 20.3653 18.4376C20.357 18.4483 20.3495 18.4569 20.3438 18.4639C20.341 18.4674 20.3391 18.4711 20.3369 18.4737L20.3321 18.4786C20.3318 18.4789 20.3311 18.4802 19.7549 18.0001L20.3311 18.4805C20.0659 18.7986 19.5926 18.8414 19.2744 18.5763C18.9762 18.3276 18.9201 17.8962 19.1328 17.5811L19.1748 17.5255C19.1748 17.5255 19.1751 17.5244 19.1758 17.5235L19.1778 17.5216L19.1787 17.5196C19.1841 17.5126 19.1944 17.499 19.209 17.4786C19.2388 17.4369 19.2861 17.367 19.3457 17.2677C19.4651 17.0687 19.6335 16.751 19.8047 16.3057C20.1465 15.4171 20.5049 14.0085 20.5049 12.0001Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:volume-small-bold-duotone": {
      body: '<g fill="currentColor"><path d="M3.00312 11.7155C3.0421 9.87326 3.06159 8.95215 3.70045 8.16363C3.81705 8.0197 3.98814 7.8487 4.13153 7.73274C4.91718 7.09741 5.95444 7.09741 8.02898 7.09741C8.77015 7.09741 9.14074 7.09741 9.49401 7.00452C9.56741 6.98522 9.64004 6.96296 9.71173 6.93781C10.0567 6.81674 10.3661 6.60837 10.985 6.19161C13.4265 4.54738 14.6473 3.72527 15.672 4.08241C15.8684 4.15088 16.0586 4.24972 16.2284 4.37162C17.1142 5.00744 17.1815 6.48675 17.3161 9.44537C17.3659 10.5409 17.3999 11.4785 17.3999 12C17.3999 12.5215 17.3659 13.4591 17.3161 14.5546C17.1815 17.5132 17.1142 18.9926 16.2284 19.6284C16.0586 19.7503 15.8684 19.8491 15.672 19.9176C14.6473 20.2747 13.4265 19.4526 10.985 17.8084C10.3661 17.3916 10.0567 17.1833 9.71173 17.0622C9.64004 17.037 9.56741 17.0148 9.49401 16.9955C9.14074 16.9026 8.77016 16.9026 8.02898 16.9026C5.95444 16.9026 4.91718 16.9026 4.13153 16.2673C3.98814 16.1513 3.81705 15.9803 3.70045 15.8364C3.06159 15.0478 3.0421 14.1267 3.00312 12.2845C3.00107 12.1878 3 12.0928 3 12C3 11.9072 3.00107 11.8122 3.00312 11.7155Z"/><path fill-rule="evenodd" d="M19.4505 8.41592C19.7981 8.21868 20.2365 8.34659 20.4296 8.70163L19.8002 9.05876C20.4296 8.70163 20.4296 8.70163 20.4296 8.70163L20.4303 8.70291L20.431 8.70428L20.4326 8.70727L20.4363 8.71425L20.4456 8.73224C20.4525 8.74604 20.4611 8.76345 20.4709 8.78454C20.4906 8.82672 20.5155 8.88359 20.5437 8.95571C20.6002 9.1 20.6699 9.30487 20.7376 9.57473C20.8733 10.1149 21.0002 10.9118 21.0002 12.0003C21.0002 13.0888 20.8733 13.8857 20.7376 14.4259C20.6699 14.6958 20.6002 14.9006 20.5437 15.0449C20.5155 15.117 20.4906 15.1739 20.4709 15.2161C20.4611 15.2372 20.4525 15.2546 20.4456 15.2684L20.4363 15.2864L20.4326 15.2934L20.431 15.2963L20.4303 15.2977C20.4303 15.2977 20.4296 15.299 19.8002 14.9419L20.4296 15.299C20.2365 15.654 19.7981 15.782 19.4505 15.5847C19.1059 15.3891 18.9798 14.9474 19.166 14.5938L19.1708 14.5838C19.1774 14.5696 19.1899 14.5415 19.2067 14.4987C19.2402 14.4132 19.2905 14.2687 19.3428 14.0606C19.4472 13.6448 19.5602 12.9709 19.5602 12.0003C19.5602 11.0297 19.4472 10.3558 19.3428 9.94003C19.2905 9.73189 19.2402 9.58745 19.2067 9.50194C19.1899 9.45915 19.1774 9.43099 19.1708 9.41687L19.166 9.40684C18.9798 9.05328 19.1059 8.61149 19.4505 8.41592Z" clip-rule="evenodd" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:widget-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 6.5C2 4.37868 2 3.31802 2.65901 2.65901C3.31802 2 4.37868 2 6.5 2C8.62132 2 9.68198 2 10.341 2.65901C11 3.31802 11 4.37868 11 6.5C11 8.62132 11 9.68198 10.341 10.341C9.68198 11 8.62132 11 6.5 11C4.37868 11 3.31802 11 2.65901 10.341C2 9.68198 2 8.62132 2 6.5Z" opacity=".5"/><path d="M13 17.5C13 15.3787 13 14.318 13.659 13.659C14.318 13 15.3787 13 17.5 13C19.6213 13 20.682 13 21.341 13.659C22 14.318 22 15.3787 22 17.5C22 19.6213 22 20.682 21.341 21.341C20.682 22 19.6213 22 17.5 22C15.3787 22 14.318 22 13.659 21.341C13 20.682 13 19.6213 13 17.5Z" opacity=".5"/><path d="M2 17.5C2 15.3787 2 14.318 2.65901 13.659C3.31802 13 4.37868 13 6.5 13C8.62132 13 9.68198 13 10.341 13.659C11 14.318 11 15.3787 11 17.5C11 19.6213 11 20.682 10.341 21.341C9.68198 22 8.62132 22 6.5 22C4.37868 22 3.31802 22 2.65901 21.341C2 20.682 2 19.6213 2 17.5Z"/><path d="M13 6.5C13 4.37868 13 3.31802 13.659 2.65901C14.318 2 15.3787 2 17.5 2C19.6213 2 20.682 2 21.341 2.65901C22 3.31802 22 4.37868 22 6.5C22 8.62132 22 9.68198 21.341 10.341C20.682 11 19.6213 11 17.5 11C15.3787 11 14.318 11 13.659 10.341C13 9.68198 13 8.62132 13 6.5Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:wind-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M6.25 5.5C6.25 3.70508 7.70507 2.25 9.5 2.25C11.2949 2.25 12.75 3.70507 12.75 5.5C12.75 7.29493 11.2949 8.75 9.5 8.75H3C2.58579 8.75 2.25 8.41421 2.25 8C2.25 7.58579 2.58579 7.25 3 7.25H9.5C10.4665 7.25 11.25 6.4665 11.25 5.5C11.25 4.5335 10.4665 3.75 9.5 3.75C8.5335 3.75 7.75 4.5335 7.75 5.5V5.85714C7.75 6.27136 7.41421 6.60714 7 6.60714C6.58579 6.60714 6.25 6.27136 6.25 5.85714V5.5Z" clip-rule="evenodd"/><path d="M3.25 14C3.25 13.5858 3.58579 13.25 4 13.25H18.5C20.8472 13.25 22.75 15.1528 22.75 17.5C22.75 19.8472 20.8472 21.75 18.5 21.75C16.1528 21.75 14.25 19.8472 14.25 17.5V17C14.25 16.5858 14.5858 16.25 15 16.25C15.4142 16.25 15.75 16.5858 15.75 17V17.5C15.75 19.0188 16.9812 20.25 18.5 20.25C20.0188 20.25 21.25 19.0188 21.25 17.5C21.25 15.9812 20.0188 14.75 18.5 14.75H4C3.58579 14.75 3.25 14.4142 3.25 14Z" opacity=".5"/><path d="M14.25 7.5C14.25 5.15279 16.1528 3.25 18.5 3.25C20.8472 3.25 22.75 5.15279 22.75 7.5C22.75 9.84721 20.8472 11.75 18.5 11.75H2C1.58579 11.75 1.25 11.4142 1.25 11C1.25 10.5858 1.58579 10.25 2 10.25H18.5C20.0188 10.25 21.25 9.01878 21.25 7.5C21.25 5.98122 20.0188 4.75 18.5 4.75C16.9812 4.75 15.75 5.98122 15.75 7.5V8C15.75 8.41421 15.4142 8.75 15 8.75C14.5858 8.75 14.25 8.41421 14.25 8V7.5Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    }
  };

  // src/icon.js
  function iconSvg(name) {
    const ic = name && ICONS[name];
    if (!ic)
      return null;
    return `<svg viewBox="${ic.vb}" fill="currentColor" style="width:100%;height:100%;display:block" aria-hidden="true">${ic.body}</svg>`;
  }

  class FibIcon extends HTMLElement {
    static get observedAttributes() {
      return ["icon"];
    }
    connectedCallback() {
      this.style.display = "inline-flex";
      this.style.alignItems = "center";
      this.style.justifyContent = "center";
      this._render();
    }
    attributeChangedCallback() {
      if (this.isConnected)
        this._render();
    }
    _render() {
      const name = this.getAttribute("icon") || "";
      const svg2 = iconSvg(name);
      if (svg2) {
        this.innerHTML = svg2;
        return;
      }
      let ha = this.firstElementChild;
      if (!ha || ha.localName !== "ha-icon") {
        this.innerHTML = "";
        ha = document.createElement("ha-icon");
        ha.style.setProperty("--mdc-icon-size", "inherit");
        this.appendChild(ha);
      }
      ha.setAttribute("icon", name);
    }
  }
  if (!customElements.get("fib-icon"))
    customElements.define("fib-icon", FibIcon);

  // src/body-layer.js
  var bar = {
    host: null,
    owners: new Set,
    config: null,
    height: 0,
    hidden: false,
    lastScroll: 0
  };
  var HOST_CSS = `
  :host {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; display: block;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none; user-select: none;
    touch-action: manipulation;
    transition: transform .22s ease;
  }
  :host([data-hidden="true"]) { transform: translateY(110%); }
  @media (prefers-reduced-motion: reduce) { :host { transition: none; } }
  .bar {
    display: flex; align-items: stretch; gap: 2px;
    background: ${T.nav};
    border-top: 1px solid ${T.line};
    padding: 7px 6px calc(9px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 60px 0 60px ${T.nav};
    transform: translateZ(0);
  }
`;
  var hostSheet = new CSSStyleSheet;
  hostSheet.replaceSync(HOST_CSS);
  function measureBar() {
    if (!bar.host)
      return;
    const div = bar.host.shadowRoot.querySelector(".bar");
    const h = div ? div.getBoundingClientRect().height : 0;
    if (h && Math.abs(h - bar.height) > 0.5) {
      bar.height = h;
      bar.owners.forEach((o) => o._syncSpacer && o._syncSpacer());
    }
  }
  function buildBar() {
    const host = document.createElement("div");
    host.id = "fibbers-nav";
    host.setAttribute("role", "navigation");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [twSheet, hostSheet];
    const div = document.createElement("div");
    div.className = "bar";
    shadow.append(div);
    document.body.appendChild(host);
    if (window.ResizeObserver)
      new ResizeObserver(() => measureBar()).observe(div);
    window.addEventListener("orientationchange", () => setTimeout(measureBar, 250));
    window.addEventListener("resize", measureBar);
    return host;
  }
  function tabMatches(tab, path) {
    const target = norm(tab.path);
    if (tab.match === "prefix")
      return path === target || path.startsWith(target + "/");
    return path === target;
  }
  function activeIndex(tabs, path) {
    const exact = tabs.findIndex((t) => norm(t.path) === path);
    if (exact !== -1)
      return exact;
    const pre = tabs.findIndex((t) => tabMatches(t, path));
    if (pre !== -1)
      return pre;
    const root = nav.stack.length ? norm(nav.stack[0]) : null;
    return root ? tabs.findIndex((t) => norm(t.path) === root) : -1;
  }
  function badgeActive(badge, hass) {
    const st = hass && hass.states[badge.entity];
    if (!st)
      return false;
    if (badge.when)
      return st.state === badge.when;
    return !["off", "unavailable", "unknown"].includes(st.state);
  }
  var press = (e, on) => on ? e.currentTarget.setAttribute("data-pressed", "true") : e.currentTarget.removeAttribute("data-pressed");
  function renderBar() {
    if (!bar.host || !bar.config)
      return;
    const div = bar.host.shadowRoot.querySelector(".bar");
    const tabs = bar.config.tabs || [];
    const active = activeIndex(tabs, here());
    render(html`${tabs.map((tab, i) => {
      const badge = tab.badge && badgeActive(tab.badge, nav.hassRef);
      return html`<button
        type="button"
        aria-current=${i === active ? "page" : nothing}
        class="relative flex min-w-0 flex-1 flex-col items-center gap-[3px] rounded-[9px]
               px-0.5 pb-[3px] pt-[5px] text-[9.5px] font-medium leading-[1.1] tracking-[0.01em]
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent
               focus-visible:[outline-offset:-2px]
               data-[pressed=true]:bg-[rgba(255,255,255,0.06)]
               ${i === active ? "bg-[rgba(116,185,138,0.10)] text-accent" : "text-muted"}"
        @pointerdown=${(e) => press(e, true)}
        @pointerup=${(e) => press(e, false)}
        @pointercancel=${(e) => press(e, false)}
        @pointerleave=${(e) => press(e, false)}
        @click=${() => {
        if (norm(tab.path) === here())
          return;
        navigate(tab.path);
      }}
      >
        <fib-icon
          class="pointer-events-none h-[17px] w-[17px] [--mdc-icon-size:17px]"
          icon=${tab.icon || "solar:record-circle-bold-duotone"}
        ></fib-icon>
        <span class="pointer-events-none">${tab.name || ""}</span>
        ${badge ? html`<span
                class="absolute left-1/2 top-1 ml-[7px] h-[5px] w-[5px] rounded-full bg-accent"
              ></span>` : ""}
      </button>`;
    })}`, div);
    measureBar();
  }
  var autoHideBound = false;
  function enableAutoHide() {
    if (autoHideBound)
      return;
    autoHideBound = true;
    document.addEventListener("scroll", (e) => {
      const y = e.target && e.target.scrollTop || 0;
      const dy = y - bar.lastScroll;
      if (Math.abs(dy) < 6)
        return;
      bar.lastScroll = y;
      const hide = dy > 0 && y > 40;
      if (hide !== bar.hidden && bar.host) {
        bar.hidden = hide;
        bar.host.setAttribute("data-hidden", String(hide));
      }
    }, { capture: true, passive: true });
  }
  function attach(owner, config) {
    bar.owners.add(owner);
    bar.config = config;
    registerTabs((config.tabs || []).map((t) => t.path));
    if (!bar.host || !document.body.contains(bar.host))
      bar.host = buildBar();
    const offset = Number(config.offset_bottom) || 0;
    bar.host.style.bottom = offset ? offset + "px" : "";
    renderBar();
    measureBar();
    if (config.auto_hide)
      enableAutoHide();
    setTabHiding(config.hide_ha_tabs);
  }
  function detach(owner) {
    bar.owners.delete(owner);
    if (bar.owners.size === 0 && bar.host) {
      bar.host.remove();
      bar.host = null;
      bar.height = 0;
      removeTabHiding();
    }
  }
  nav.listeners.add(renderBar);
  window.addEventListener("hashchange", renderBar);

  // src/global-css.js
  var STYLE_ID2 = "fibbers-global";
  var VARS = {
    "--primary-background-color": T.bg,
    "--secondary-background-color": T.nav,
    "--card-background-color": T.card,
    "--ha-card-background": T.card,
    "--app-header-background-color": T.bg,
    "--app-header-text-color": T.ink,
    "--sidebar-background-color": "#0E1315",
    "--sidebar-icon-color": T.muted,
    "--sidebar-text-color": T.ink2,
    "--sidebar-selected-icon-color": T.accent,
    "--sidebar-selected-text-color": T.ink,
    "--divider-color": T.line,
    "--primary-text-color": T.ink,
    "--secondary-text-color": "#8B999C",
    "--disabled-text-color": "#5C6A6D",
    "--text-primary-color": T.bg,
    "--primary-color": T.accent,
    "--accent-color": T.accent,
    "--state-icon-color": "#8B999C",
    "--state-icon-active-color": T.accent,
    "--error-color": T.red,
    "--warning-color": T.amber,
    "--success-color": T.green,
    "--info-color": T.blue,
    "--ha-card-border-radius": "15px",
    "--ha-card-border-width": "1px",
    "--ha-card-border-color": T.line,
    "--ha-card-box-shadow": "none",
    "--ha-dialog-border-radius": "22px",
    "--mdc-dialog-scrim-color": "rgba(6,9,10,.72)",
    "--mdc-theme-surface": T.sheet,
    "--ha-dialog-surface-background": T.sheet,
    "--more-info-header-background": T.sheet,
    "--dialog-backdrop-filter": "blur(3px)",
    "--switch-checked-color": T.accent,
    "--switch-checked-button-color": T.ink,
    "--switch-checked-track-color": "#2E5238",
    "--switch-unchecked-button-color": "#8B999C",
    "--switch-unchecked-track-color": T.line,
    "--paper-slider-active-color": T.accent,
    "--paper-slider-knob-color": T.accent,
    "--paper-slider-container-color": "#2C3639"
  };
  function injectGlobalCss() {
    if (window.FIBBERS_DISABLE_GLOBAL_CSS)
      return;
    if (document.getElementById(STYLE_ID2))
      return;
    const decls = Object.entries(VARS).map(([k, v]) => `  ${k}: ${v} !important;`).join(`
`);
    const style = document.createElement("style");
    style.id = STYLE_ID2;
    style.textContent = `html {
${decls}
}`;
    document.head.appendChild(style);
  }

  // src/cards/nav.js
  class FibbersNav extends LitElement {
    static properties = { _spacerH: { state: true } };
    static styles = [
      css`
      :host {
        display: block;
      }
    `
    ];
    constructor() {
      super();
      this._spacerH = 0;
    }
    static getStubConfig() {
      return {
        type: "custom:fibbers-nav",
        tabs: [
          {
            name: "Huis",
            icon: "solar:home-2-bold-duotone",
            path: "/dashboard-thuis/huis"
          },
          {
            name: "Licht",
            icon: "solar:lightbulb-bolt-bold-duotone",
            path: "/dashboard-thuis/licht"
          }
        ]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.tabs) || !config.tabs.length) {
        throw new Error("fibbers-nav: `tabs` must be a non-empty list of {name, icon, path}");
      }
      config.tabs.forEach((t, i) => {
        if (!t || !t.path)
          throw new Error(`fibbers-nav: tabs[${i}] is missing \`path\``);
      });
      if (config.offset_bottom != null && !Number.isFinite(Number(config.offset_bottom))) {
        throw new Error("fibbers-nav: `offset_bottom` must be a number of pixels");
      }
      if (config.hide_ha_tabs != null && config.hide_ha_tabs !== true && config.hide_ha_tabs !== false && config.hide_ha_tabs !== "header") {
        throw new Error('fibbers-nav: `hide_ha_tabs` must be false, true, or "header"');
      }
      this._config = config;
      this._syncSpacer();
      if (this.isConnected)
        attach(this, this._config);
    }
    _syncSpacer() {
      const cfg = this._config || {};
      const offset = Number(cfg.offset_bottom) || 0;
      const base = cfg.reserve != null ? cfg.reserve : bar.height || 74;
      this._spacerH = Math.round(base + offset);
    }
    set hass(hass) {
      nav.hassRef = hass;
      if (this._config && (this._config.tabs || []).some((t) => t.badge))
        renderBar();
    }
    connectedCallback() {
      super.connectedCallback();
      if (this._config)
        attach(this, this._config);
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      detach(this);
    }
    render() {
      return html`<div style="height:${this._spacerH || 0}px"></div>`;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/back.js
  class FibbersBack extends LitElement {
    static properties = {
      _config: { state: true },
      _label: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return { type: "custom:fibbers-back", fallback: "/dashboard-thuis/huis" };
    }
    setConfig(config) {
      this._config = config || {};
      this._compute();
    }
    set hass(_hass) {}
    connectedCallback() {
      super.connectedCallback();
      this._onRoute = () => this._compute();
      nav.listeners.add(this._onRoute);
      this._compute();
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._onRoute)
        nav.listeners.delete(this._onRoute);
    }
    _compute() {
      const c = this._config || {};
      if (c.label) {
        this._label = c.label;
        return;
      }
      const prev = previous() || c.fallback;
      const names = c.labels || {};
      const name = prev ? names[norm(prev)] || names[prev] : null;
      this._label = name ? `Terug naar ${name}` : "Terug";
    }
    render() {
      const c = this._config || {};
      return html`<button
      type="button"
      class="flex w-full items-center gap-2 rounded-xl border border-line bg-card
             px-3.5 py-3 text-[12.5px] font-medium text-ink2 active:bg-card2"
      @click=${() => goBack(c.fallback)}
    >
      <fib-icon
        class="h-[18px] w-[18px] [--mdc-icon-size:18px] text-muted"
        icon=${c.icon || "solar:alt-arrow-left-bold-duotone"}
      ></fib-icon>
      <span>${this._label}</span>
    </button>`;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/body-sheet.js
  var layer = {
    host: null,
    shadow: null,
    backdrop: null,
    panel: null,
    headEl: null,
    bodyEl: null,
    sheets: new Map,
    openId: null,
    savedScrollY: 0,
    drag: null,
    built: false
  };
  var reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SHEET_CSS = `
  :host {
    position: fixed; inset: 0; z-index: 9; display: none;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: ${T.ink};
    -webkit-font-smoothing: antialiased;
  }
  :host([data-open="true"]) { display: block; }

  .backdrop {
    position: absolute; inset: 0;
    background: rgba(6, 9, 10, .72);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
    opacity: 0; transition: opacity .24s ease;
  }
  :host([data-shown="true"]) .backdrop { opacity: 1; }

  .sheet {
    position: absolute; left: 0; right: 0; bottom: 0;
    max-height: 88vh; display: flex; flex-direction: column;
    background: ${T.sheet};
    border-top: 1px solid ${T.line};
    border-radius: 24px 24px 0 0;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    transform: translateY(100%);
    transition: transform .28s cubic-bezier(.22, 1, .36, 1);
  }
  :host([data-shown="true"]) .sheet { transform: translateY(0); }
  @media (prefers-reduced-motion: reduce) { .backdrop, .sheet { transition: none; } }

  .grab {
    width: 34px; height: 4px; border-radius: 2px;
    background: ${T.grab};
    margin: 4px auto 10px; flex: 0 0 auto;
    touch-action: none; cursor: grab;
  }
  .head {
    display: flex; align-items: center; gap: 10px;
    padding: 0 2px 12px; flex: 0 0 auto; touch-action: none;
  }
  .body {
    flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch;
    display: flex; flex-direction: column; gap: 10px; padding-bottom: 6px;
  }

  @media (min-width: 640px) {
    .sheet {
      inset: 0; margin: auto; height: fit-content; max-height: 88vh;
      width: min(460px, calc(100vw - 32px));
      border-radius: 24px; border: 1px solid ${T.line};
      opacity: 0; transform: translateY(8px);
      transition: opacity .2s ease, transform .2s ease;
    }
    :host([data-shown="true"]) .sheet { transform: translateY(0); opacity: 1; }
  }
`;
  var sheetSheet = new CSSStyleSheet;
  sheetSheet.replaceSync(SHEET_CSS);
  function build() {
    if (layer.built)
      return;
    const host = document.createElement("div");
    host.id = "fibbers-sheet";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [twSheet, sheetSheet];
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    const grab = document.createElement("div");
    grab.className = "grab";
    const head = document.createElement("div");
    head.className = "head";
    const body = document.createElement("div");
    body.className = "body";
    sheet.append(grab, head, body);
    shadow.append(backdrop, sheet);
    document.body.appendChild(host);
    backdrop.addEventListener("click", () => closeSheet());
    bindDrag(grab, sheet);
    bindDrag(head, sheet);
    layer.host = host;
    layer.shadow = shadow;
    layer.backdrop = backdrop;
    layer.panel = sheet;
    layer.headEl = head;
    layer.bodyEl = body;
    layer.built = true;
  }
  function bindDrag(handle, sheet) {
    handle.addEventListener("pointerdown", (e) => {
      if (window.innerWidth >= 640)
        return;
      layer.drag = { startY: e.clientY, dy: 0 };
      sheet.style.transition = "none";
      handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!layer.drag)
        return;
      const dy = Math.max(0, e.clientY - layer.drag.startY);
      layer.drag.dy = dy;
      sheet.style.transform = `translateY(${dy}px)`;
      if (layer.backdrop)
        layer.backdrop.style.opacity = String(Math.max(0, 1 - dy / 400));
    });
    const end = () => {
      if (!layer.drag)
        return;
      const dy = layer.drag.dy;
      layer.drag = null;
      sheet.style.transition = "";
      sheet.style.transform = "";
      if (layer.backdrop)
        layer.backdrop.style.opacity = "";
      if (dy > 80)
        closeSheet();
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
  function lockScroll() {
    layer.savedScrollY = window.scrollY || window.pageYOffset || 0;
    const b = document.body;
    b.style.position = "fixed";
    b.style.top = `-${layer.savedScrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
  }
  function unlockScroll() {
    const b = document.body;
    b.style.position = "";
    b.style.top = "";
    b.style.left = "";
    b.style.right = "";
    b.style.width = "";
    window.scrollTo(0, layer.savedScrollY);
  }
  async function renderContent(card) {
    const cfg = card._config;
    render(html`
      ${cfg.icon ? html`<fib-icon
              class="h-5 w-5 flex-none [--mdc-icon-size:20px] text-accent"
              icon=${cfg.icon}
            ></fib-icon>` : ""}
      <div class="min-w-0 flex-1">
        <div class="text-[16px] font-semibold tracking-[-0.015em] text-ink">
          ${cfg.title || ""}
        </div>
        ${cfg.subtitle ? html`<div class="mt-0.5 text-[11px] text-muted">
                ${cfg.subtitle}
              </div>` : ""}
      </div>
      <button
        type="button"
        aria-label="Sluiten"
        class="flex h-[30px] w-[30px] flex-none cursor-pointer items-center justify-center
               rounded-full border-0 bg-card2 text-[15px] leading-none text-ink2"
        @click=${() => closeSheet()}
      >
        ✕
      </button>
    `, layer.headEl);
    const body = layer.bodyEl;
    body.textContent = "";
    card._children = [];
    const configs = Array.isArray(cfg.cards) ? cfg.cards : [];
    if (!configs.length)
      return;
    try {
      const helpers = await window.loadCardHelpers();
      for (const c of configs) {
        const el = helpers.createCardElement(c);
        if (card._hass)
          el.hass = card._hass;
        card._children.push(el);
        body.appendChild(el);
      }
    } catch (_) {
      const msg = document.createElement("div");
      msg.className = "px-2 py-2 text-[12px] text-muted";
      msg.textContent = "Kaarten konden niet geladen worden.";
      body.appendChild(msg);
    }
  }
  function openSheet(id) {
    const card = layer.sheets.get(id);
    if (!card || layer.openId === id)
      return;
    build();
    layer.openId = id;
    layer.host.setAttribute("data-open", "true");
    lockScroll();
    renderContent(card);
    requestAnimationFrame(() => requestAnimationFrame(() => layer.host.setAttribute("data-shown", "true")));
  }
  function closeSheet() {
    if (layer.openId == null)
      return;
    const id = layer.openId;
    layer.openId = null;
    if (layer.host)
      layer.host.removeAttribute("data-shown");
    if (window.location.hash === "#" + id) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const finish = () => {
      if (layer.openId != null)
        return;
      if (layer.host)
        layer.host.removeAttribute("data-open");
      if (layer.bodyEl)
        layer.bodyEl.textContent = "";
      unlockScroll();
    };
    if (reduceMotion())
      finish();
    else
      setTimeout(finish, 300);
  }
  function syncFromHash() {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && layer.sheets.has(hash))
      openSheet(hash);
    else if (layer.openId != null)
      closeSheet();
  }
  function registerSheet(id, card) {
    build();
    layer.sheets.set(id, card);
    if (window.location.hash === "#" + id)
      openSheet(id);
  }
  function unregisterSheet(id, card) {
    if (layer.sheets.get(id) === card)
      layer.sheets.delete(id);
    if (layer.openId === id)
      closeSheet();
    if (layer.sheets.size === 0 && layer.host) {
      layer.host.remove();
      layer.built = false;
      layer.host = null;
    }
  }
  function updateSheetHass(id, hass) {
    if (layer.openId !== id)
      return;
    const card = layer.sheets.get(id);
    if (card && card._children)
      card._children.forEach((el) => {
        el.hass = hass;
      });
  }
  window.addEventListener("hashchange", syncFromHash);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      closeSheet();
  });

  // src/cards/sheet.js
  class FibbersSheet extends LitElement {
    static styles = [
      css`
      :host {
        display: none;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-sheet",
        id: "woonkamer",
        title: "Woonkamer",
        icon: "solar:sofa-2-bold-duotone",
        cards: []
      };
    }
    setConfig(config) {
      if (!config || !config.id || typeof config.id !== "string") {
        throw new Error("fibbers-sheet: `id` (a unique string) is required");
      }
      if (config.cards != null && !Array.isArray(config.cards)) {
        throw new Error("fibbers-sheet: `cards` must be a list");
      }
      if (this._config && this._config.id !== config.id && this.isConnected) {
        unregisterSheet(this._config.id, this);
      }
      this._config = config;
      if (this.isConnected)
        registerSheet(config.id, this);
    }
    set hass(hass) {
      this._hass = hass;
      if (this._config)
        updateSheetHass(this._config.id, hass);
    }
    connectedCallback() {
      super.connectedCallback();
      if (this._config)
        registerSheet(this._config.id, this);
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._config)
        unregisterSheet(this._config.id, this);
    }
    render() {
      return html``;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/section.js
  class FibbersSection extends LitElement {
    static properties = { _config: { state: true } };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return { type: "custom:fibbers-section", label: "Kamers" };
    }
    setConfig(config) {
      if (!config || !config.label) {
        throw new Error("fibbers-section: `label` is required");
      }
      this._config = config;
    }
    set hass(_hass) {}
    render() {
      if (!this._config)
        return html``;
      return html`<div
      class="px-0.5 pt-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.11em] text-muted"
    >
      ${this._config.label}
    </div>`;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/room.js
  var isLight = (id) => typeof id === "string" && id.startsWith("light.");

  class FibbersRoom extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-room",
        name: "Woonkamer",
        icon: "solar:sofa-2-bold-duotone",
        entities: ["light.tv_led_strip"],
        sheet: "woonkamer"
      };
    }
    setConfig(config) {
      if (!config || !config.name) {
        throw new Error("fibbers-room: `name` is required");
      }
      if (config.entities != null && !Array.isArray(config.entities)) {
        throw new Error("fibbers-room: `entities` must be a list");
      }
      if (config.entities == null && !config.area) {
        throw new Error("fibbers-room: provide `entities` or an `area`");
      }
      this._config = config;
    }
    _entities() {
      const c = this._config;
      if (Array.isArray(c.entities))
        return c.entities;
      const hass = this.hass;
      if (!c.area || !hass || !hass.entities)
        return [];
      const devices = hass.devices || {};
      return Object.values(hass.entities).filter((e) => {
        const area = e.area_id || (devices[e.device_id] || {}).area_id;
        return area === c.area && isLight(e.entity_id);
      }).map((e) => e.entity_id);
    }
    _lights() {
      return this._entities().filter(isLight);
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      clearTimeout(this._timer);
    }
    _state() {
      const hass = this.hass;
      const lights = this._lights();
      if (!hass || !lights.length)
        return { label: "—", lit: false, offline: false };
      let on = 0, avail = 0;
      lights.forEach((id) => {
        const st = hass.states[id];
        if (!st || st.state === "unavailable" || st.state === "unknown")
          return;
        avail++;
        if (st.state === "on")
          on++;
      });
      if (avail === 0)
        return { label: "Offline", lit: false, offline: true };
      if (on === 0)
        return { label: "Uit", lit: false, offline: false };
      return {
        label: `${on} van ${lights.length} aan`,
        lit: true,
        offline: false
      };
    }
    _down() {
      this._held = false;
      this._timer = setTimeout(() => {
        this._held = true;
        this._moreInfo();
      }, 500);
    }
    _up() {
      clearTimeout(this._timer);
    }
    _click() {
      if (this._held)
        return;
      if (this._config.sheet)
        window.location.hash = this._config.sheet;
    }
    _moreInfo() {
      const ent = this._lights()[0] || this._entities()[0];
      if (!ent)
        return;
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: ent },
        bubbles: true,
        composed: true
      }));
    }
    render() {
      if (!this._config)
        return html``;
      const s = this._state();
      return html`<button
      type="button"
      class="block w-full cursor-pointer rounded-[15px] border px-[13px] pb-3 pt-[13px]
             text-left transition-colors active:translate-y-[0.5px]
             ${s.lit ? "border-[#2E5238] bg-[linear-gradient(145deg,#1E3427,#132016)]" : "border-line bg-card"}
             ${s.offline ? "opacity-[.66]" : ""}"
      @pointerdown=${this._down}
      @pointerup=${this._up}
      @pointercancel=${this._up}
      @pointerleave=${this._up}
      @click=${this._click}
    >
      <fib-icon
        class="block h-[19px] w-[19px] [--mdc-icon-size:19px] ${s.lit ? "text-accent" : "text-muted"}"
        icon=${this._config.icon || "solar:home-angle-bold-duotone"}
      ></fib-icon>
      <div class="mt-2 text-[13px] font-semibold tracking-tight text-ink">
        ${this._config.name}
      </div>
      <div class="mt-0.5 text-[11px] ${s.offline ? "text-red" : "text-muted"}">
        ${s.label}
      </div>
    </button>`;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: 6, grid_rows: 1 };
    }
  }

  // src/actions.js
  function runAction(action, hass, host, fallbackEntity) {
    const a = action || { action: "none" };
    switch (a.action) {
      case "navigate":
        if (a.navigation_path)
          navigate(a.navigation_path);
        break;
      case "url":
        if (a.url_path)
          window.open(a.url_path, a.url_path.startsWith("http") ? "_blank" : "_self");
        break;
      case "toggle": {
        const entity = a.entity || fallbackEntity;
        if (entity && hass)
          hass.callService("homeassistant", "toggle", { entity_id: entity });
        break;
      }
      case "more-info": {
        const entityId = a.entity || fallbackEntity;
        if (entityId)
          host.dispatchEvent(new CustomEvent("hass-more-info", {
            detail: { entityId },
            bubbles: true,
            composed: true
          }));
        break;
      }
      case "call-service":
      case "perform-action": {
        const svc = a.service || a.perform_action;
        if (svc && svc.includes(".") && hass) {
          const [domain, service] = svc.split(".");
          hass.callService(domain, service, a.data || a.service_data || {}, a.target);
        }
        break;
      }
      default:
        break;
    }
  }

  // src/cards/light-row.js
  var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  class FibbersLightRow extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true },
      _dragging: { state: true },
      _dragPct: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return { type: "custom:fibbers-light-row", entity: "light.tv_led_strip" };
    }
    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("fibbers-light-row: `entity` is required");
      }
      if (config.icon_tap_action != null && (typeof config.icon_tap_action !== "object" || typeof config.icon_tap_action.action !== "string")) {
        throw new Error("fibbers-light-row: `icon_tap_action` must be a HA action object (with an `action`)");
      }
      this._config = config;
      this._dragging = false;
      this._dragPct = 0;
    }
    _st() {
      return this.hass && this.hass.states[this._config.entity];
    }
    _unavail() {
      const st = this._st();
      return !st || st.state === "unavailable" || st.state === "unknown";
    }
    _pctFromHass() {
      const st = this._st();
      if (!st || st.state !== "on")
        return 0;
      const b = st.attributes.brightness;
      return b != null ? Math.round(b / 255 * 100) : 100;
    }
    _displayPct() {
      return this._dragging ? this._dragPct : this._pctFromHass();
    }
    _warmth() {
      const st = this._st();
      if (!st)
        return "";
      const mode = st.attributes.color_mode;
      if (mode && ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode))
        return "Kleur";
      const k = st.attributes.color_temp_kelvin || (st.attributes.color_temp ? Math.round(1e6 / st.attributes.color_temp) : null);
      if (k == null)
        return "";
      if (k < 3000)
        return "Warm";
      if (k < 4600)
        return "Neutraal";
      return "Koel";
    }
    _pctFromX(clientX, track) {
      const r = track.getBoundingClientRect();
      return Math.round(clamp((clientX - r.left) / r.width * 100, 0, 100));
    }
    _down(e) {
      if (this._unavail())
        return;
      const track = e.currentTarget;
      this._dragging = true;
      track.setPointerCapture && track.setPointerCapture(e.pointerId);
      this._dragPct = this._pctFromX(e.clientX, track);
    }
    _move(e) {
      if (!this._dragging)
        return;
      this._dragPct = this._pctFromX(e.clientX, e.currentTarget);
    }
    _up(e) {
      if (!this._dragging)
        return;
      const pct = this._pctFromX(e.clientX, e.currentTarget);
      this._dragging = false;
      this._commit(pct);
    }
    _commit(pct) {
      if (!this.hass)
        return;
      const entity_id = this._config.entity;
      if (pct <= 0)
        this.hass.callService("light", "turn_off", { entity_id });
      else
        this.hass.callService("light", "turn_on", {
          entity_id,
          brightness_pct: pct
        });
    }
    _iconAction() {
      return this._config.icon_tap_action || { action: "toggle" };
    }
    _moreInfo() {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true
      }));
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const st = this._st();
      const unavail = this._unavail();
      const on = !unavail && st.state === "on";
      const pct = this._displayPct();
      const name = cfg.name || st && st.attributes.friendly_name || cfg.entity;
      const icon = cfg.icon || st && st.attributes.icon || "solar:lightbulb-bold-duotone";
      let val;
      if (unavail)
        val = "Onbereikbaar";
      else if (on) {
        const w = this._warmth();
        val = w ? `${w} · ${pct}%` : `${pct}%`;
      } else
        val = "Uit";
      return html`
      <div
        class="grid grid-cols-[28px_1fr] grid-rows-[auto_auto] items-center gap-x-2.5
               gap-y-2 py-2 ${unavail ? "opacity-50" : ""}"
      >
        <div
          role="button"
          class="row-span-2 flex h-7 w-7 items-center justify-center rounded-lg
                 transition-transform active:scale-90 ${on ? "bg-accentbg" : "bg-card2"} ${unavail ? "pointer-events-none" : "cursor-pointer"}"
          @click=${() => runAction(this._iconAction(), this.hass, this, cfg.icon_entity || cfg.entity)}
        >
          <fib-icon
            class="h-[17px] w-[17px] [--mdc-icon-size:17px] ${on ? "text-accent" : "text-muted"}"
            icon=${icon}
          ></fib-icon>
        </div>

        <div
          class="flex cursor-pointer items-baseline justify-between gap-2"
          @click=${() => this._moreInfo()}
        >
          <span class="text-[12px] font-medium text-ink">${name}</span>
          <span class="whitespace-nowrap text-[10.5px] text-muted">${val}</span>
        </div>

        <div
          class="relative h-1.5 cursor-pointer touch-none rounded-[3px] bg-[#2C3639]
                 ${unavail ? "pointer-events-none" : ""}"
          @pointerdown=${this._down}
          @pointermove=${this._move}
          @pointerup=${this._up}
          @pointercancel=${() => this._dragging = false}
        >
          ${unavail ? "" : html`
                  <div
                    class="absolute bottom-0 left-0 top-0 rounded-[3px] bg-accent"
                    style="width:${pct}%"
                  ></div>
                  <div
                    class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2
                         rounded-full bg-accent shadow-[0_1px_3px_rgba(0,0,0,.4)]"
                    style="left:${pct}%"
                  ></div>
                `}
        </div>
      </div>
    `;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/alert.js
  var friendly = (s) => s.attributes && s.attributes.friendly_name || s.entity_id;
  var isUnavail = (st) => !st || st.state === "unavailable" || st.state === "unknown";
  function runCheck(check, hass) {
    const states = Object.values(hass.states);
    const out = [];
    switch (check.type) {
      case "unavailable_lights": {
        const exclude = check.exclude || [];
        const offline = states.filter((s) => s.entity_id.startsWith("light.") && !exclude.includes(s.entity_id) && isUnavail(s));
        if (offline.length)
          out.push({
            label: offline.length === 1 ? "Lamp offline" : "Lampen offline",
            detail: offline.map(friendly).join(", "),
            entity: offline[0].entity_id
          });
        break;
      }
      case "low_battery": {
        const below = check.below != null ? check.below : 20;
        const pat = check.exclude_pattern ? new RegExp(check.exclude_pattern) : null;
        states.filter((s) => (s.attributes || {}).device_class === "battery" && !isNaN(parseFloat(s.state)) && parseFloat(s.state) < below && !(pat && pat.test(s.entity_id))).forEach((s) => out.push({
          label: "Batterij laag",
          detail: `${friendly(s)} (${s.state}%)`,
          entity: s.entity_id
        }));
        break;
      }
      case "updates": {
        const ups = states.filter((s) => s.entity_id.startsWith("update.") && s.state === "on");
        if (ups.length)
          out.push({
            label: "Updates",
            detail: ups.length === 1 ? `1 update beschikbaar` : `${ups.length} updates beschikbaar`,
            entity: ups[0].entity_id
          });
        break;
      }
      case "backup_age": {
        const st = hass.states[check.entity];
        const max = check.max_hours != null ? check.max_hours : 26;
        if (st && !isUnavail(st)) {
          const t = Date.parse(st.state);
          if (!isNaN(t)) {
            const hours = (Date.now() - t) / 3600000;
            if (hours > max)
              out.push({
                label: "Back-up",
                detail: `${Math.round(hours)} uur geleden`,
                entity: check.entity
              });
          }
        }
        break;
      }
    }
    return out;
  }

  class FibbersAlert extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-alert",
        checks: [{ type: "unavailable_lights" }, { type: "updates" }]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.checks)) {
        throw new Error("fibbers-alert: `checks` must be a list");
      }
      this._config = config;
    }
    _findings() {
      if (!this.hass)
        return [];
      const out = [];
      this._config.checks.forEach((c) => {
        try {
          out.push(...runCheck(c, this.hass));
        } catch (_) {}
      });
      return out;
    }
    _moreInfo(entity) {
      if (!entity)
        return;
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: entity },
        bubbles: true,
        composed: true
      }));
    }
    render() {
      if (!this._config)
        return html``;
      const findings = this._findings();
      const alert = findings.length > 0;
      return html`<div
      class="rounded-xl border p-3
             ${alert ? "border-amberline bg-amberbg" : "border-line bg-card"}"
    >
      <div class="flex items-center gap-2">
        <fib-icon
          class="h-4 w-4 [--mdc-icon-size:16px] ${alert ? "text-amber" : "text-green"}"
          icon=${alert ? "solar:danger-triangle-bold-duotone" : "solar:check-circle-bold-duotone"}
        ></fib-icon>
        <span
          class="text-[12px] font-semibold ${alert ? "text-amber" : "text-green"}"
          >${alert ? "Aandacht nodig" : "Alles in orde"}</span
        >
      </div>
      ${alert ? html`<div class="mt-2 flex flex-col gap-[5px]">
              ${findings.map((f) => html`<div
                    class="cursor-pointer text-[11.5px] leading-[1.42] text-ambertx"
                    @click=${() => this._moreInfo(f.entity)}
                  >
                    <b class="font-semibold text-amber">${f.label}</b> —
                    ${f.detail}
                  </div>`)}
            </div>` : ""}
    </div>`;
    }
    getCardSize() {
      return 2;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 2 };
    }
  }

  // src/cards/chips.js
  class FibbersChips extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-chips",
        chips: [
          {
            name: "Alles uit",
            icon: "solar:power-bold-duotone",
            action: { action: "toggle" }
          }
        ]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.chips)) {
        throw new Error("fibbers-chips: `chips` must be a list");
      }
      this._config = config;
    }
    _active(chip) {
      const aw = chip.active_when;
      if (!aw || !aw.entity || !this.hass)
        return false;
      const st = this.hass.states[aw.entity];
      return !!(st && (aw.state != null ? st.state === aw.state : st.state === "on"));
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      return html`<div class="flex flex-wrap gap-[7px]">
      ${cfg.chips.map((chip) => {
        const active = this._active(chip);
        return html`<button
          type="button"
          class="inline-flex items-center gap-[5px] rounded-full border px-2.5 py-[5px]
                 text-[10.5px] font-medium
                 ${active ? "border-blueline bg-bluebg text-blueink" : "border-line bg-card2 text-ink2"}"
          @click=${() => this.hass && runAction(chip.action || chip.tap_action, this.hass, this, chip.entity)}
        >
          ${chip.icon ? html`<fib-icon
                  class="h-[13px] w-[13px] [--mdc-icon-size:13px]"
                  icon=${chip.icon}
                ></fib-icon>` : ""}
          <span>${chip.name || ""}</span>
        </button>`;
      })}
    </div>`;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/scene.js
  var activatedAt = (st) => {
    if (!st)
      return 0;
    const raw = st.attributes && st.attributes.last_activated || st.state || null;
    const t = raw ? Date.parse(raw) : NaN;
    return isNaN(t) ? 0 : t;
  };

  class FibbersScene extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true },
      _open: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-scene",
        scenes: [
          {
            name: "Avond",
            icon: "solar:moon-bold-duotone",
            scene: "scene.avond"
          }
        ]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.scenes) || !config.scenes.length) {
        throw new Error("fibbers-scene: `scenes` must be a non-empty list");
      }
      config.scenes.forEach((s, i) => {
        if (!s || !s.scene)
          throw new Error(`fibbers-scene: scenes[${i}] is missing \`scene\``);
      });
      if (config.favourites != null && (!Number.isInteger(config.favourites) || config.favourites < 1)) {
        throw new Error("fibbers-scene: `favourites` must be a positive integer");
      }
      this._config = config;
      this._open = false;
    }
    _fav() {
      const n = this._config.favourites;
      return n && n < this._config.scenes.length ? n : this._config.scenes.length;
    }
    _activeIndex() {
      if (!this.hass)
        return -1;
      let best = -1, bestT = 0;
      this._config.scenes.forEach((s, i) => {
        const t = activatedAt(this.hass.states[s.scene]);
        if (t > bestT) {
          bestT = t;
          best = i;
        }
      });
      return best;
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const fav = this._fav();
      const active = this._activeIndex();
      const total = cfg.scenes.length;
      const hidden = total - fav;
      const tile = (s, i) => {
        const isActive = i === active;
        const show = i < fav || this._open;
        return html`<button
        type="button"
        ?hidden=${!show}
        class="flex flex-col items-center gap-[7px] rounded-[14px] border p-3.5
               text-ink2 transition-transform active:scale-[.96]
               ${isActive ? "border-[#2E5238] bg-[linear-gradient(145deg,#1E3427,#132016)] text-accenttx" : "border-line bg-card"}"
        @click=${() => this.hass && this.hass.callService("scene", "turn_on", { entity_id: s.scene })}
      >
        <fib-icon
          class="h-5 w-5 [--mdc-icon-size:20px] ${isActive ? "text-accent" : "text-muted"}"
          icon=${s.icon || "solar:palette-bold-duotone"}
        ></fib-icon>
        <span class="text-center text-[11px] font-medium"
          >${s.name || s.scene}</span
        >
      </button>`;
      };
      return html`
      <div class="grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-2">
        ${cfg.scenes.map(tile)}
      </div>
      ${hidden > 0 ? html`<button
              type="button"
              class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[11px]
                   border border-line bg-transparent py-[9px] text-[11px] font-medium text-ink2"
              @click=${() => this._open = !this._open}
            >
              <span>${this._open ? "Minder" : `Alle ${total} scènes`}</span>
              <fib-icon
                class="h-[15px] w-[15px] text-muted transition-transform [--mdc-icon-size:15px]
                     ${this._open ? "rotate-180" : ""}"
                icon="solar:alt-arrow-down-bold-duotone"
              ></fib-icon>
            </button>` : ""}
    `;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/stat.js
  var COLORS = ["accent", "amber", "blue", "green", "red"];
  var IC = {
    accent: "bg-accentbg text-accent",
    amber: "bg-amberbg text-amber",
    blue: "bg-bluebg text-blueink",
    green: "bg-accentbg text-green",
    red: "bg-amberbg text-red"
  };
  var fmt = (raw, decimals) => {
    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n))
      return String(raw);
    const o = decimals != null ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {};
    return n.toLocaleString("nl-NL", o);
  };

  class FibbersStat extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-stat",
        entity: "sensor.hue_motion_sensor_1_temperature"
      };
    }
    setConfig(config) {
      if (!config || !config.entity && config.value == null) {
        throw new Error("fibbers-stat: `entity` or `value` is required");
      }
      if (config.color != null && !COLORS.includes(config.color)) {
        throw new Error(`fibbers-stat: \`color\` must be one of ${COLORS.join(", ")}`);
      }
      this._config = config;
    }
    _st() {
      return this._config && this._config.entity && this.hass ? this.hass.states[this._config.entity] : null;
    }
    _offline() {
      if (!this._config.entity)
        return false;
      const st = this._st();
      return !st || st.state === "unavailable" || st.state === "unknown";
    }
    _tap() {
      const cfg = this._config;
      const tap = cfg.tap_action || cfg.entity && { action: "more-info" };
      if (tap && tap.action !== "none")
        runAction(tap, this.hass, this, cfg.entity);
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const st = this._st();
      const offline = this._offline();
      const color = cfg.color || "accent";
      const icon = cfg.icon || st && st.attributes.icon || "solar:widget-bold-duotone";
      const label = cfg.name || st && st.attributes.friendly_name || cfg.entity || "";
      const value = offline ? "—" : fmt(cfg.value != null ? cfg.value : st.state, cfg.decimals);
      const unit = offline ? "" : cfg.unit != null ? cfg.unit : st && st.attributes.unit_of_measurement || "";
      const trend = ["up", "down", "flat"].includes(cfg.trend) ? cfg.trend : null;
      const trendChar = trend === "up" ? "▲" : trend === "down" ? "▼" : "—";
      const trendCls = trend === "up" ? "text-red" : trend === "down" ? "text-accent" : "text-muted";
      const tappable = cfg.tap_action || cfg.entity;
      return html`
      <div
        class="grid grid-cols-[34px_1fr] items-center gap-x-3 gap-y-0.5 rounded-[14px]
               border border-line bg-card p-3 shadow-[0_1px_3px_rgba(0,0,0,.35)]
               ${tappable ? "cursor-pointer" : ""}"
        role=${tappable ? "button" : "presentation"}
        @click=${() => tappable && this._tap()}
      >
        <div
          class="row-span-2 flex h-[34px] w-[34px] items-center justify-center rounded-[10px]
                 ${offline ? "bg-card2 text-muted" : IC[color]}"
        >
          <fib-icon
            class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
            icon=${icon}
          ></fib-icon>
        </div>

        <div class="text-[11px] font-medium text-muted">${label}</div>

        <div class="flex items-baseline gap-[5px]">
          <span
            class="text-[22px] font-semibold leading-tight tracking-tight
                   ${offline ? "text-muted" : "text-ink"}"
            >${value}</span
          >
          <span class="text-[12px] font-medium text-ink2">${unit}</span>
          ${trend ? html`<span class="ml-0.5 text-[11px] font-semibold ${trendCls}"
                  >${trendChar}</span
                >` : ""}
        </div>

        ${cfg.sub ? html`<div class="col-start-2 text-[10.5px] text-muted">
                ${cfg.sub}
              </div>` : ""}
      </div>
    `;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: 6, grid_rows: 1 };
    }
  }

  // src/cards/graph.js
  var COLORS2 = ["accent", "amber", "blue", "green", "red"];
  var STROKE = {
    accent: "text-accent",
    amber: "text-amber",
    blue: "text-blue",
    green: "text-green",
    red: "text-red"
  };
  var W = 300;
  var nl = (n, d2) => Number.isFinite(n) ? n.toLocaleString("nl-NL", d2 != null ? { minimumFractionDigits: d2, maximumFractionDigits: d2 } : {}) : String(n);

  class FibbersGraph extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true },
      _series: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-graph",
        entity: "sensor.hue_motion_sensor_1_temperature",
        hours: 24
      };
    }
    setConfig(config) {
      if (!config || !config.entity && !Array.isArray(config.data)) {
        throw new Error("fibbers-graph: `entity` or `data` is required");
      }
      if (config.color != null && !COLORS2.includes(config.color)) {
        throw new Error(`fibbers-graph: \`color\` must be one of ${COLORS2.join(", ")}`);
      }
      this._config = config;
      this._series = Array.isArray(config.data) ? config.data.map(Number) : null;
      this._fetchedFor = null;
    }
    updated(changed) {
      if (changed.has("hass") && this._config.entity && !this._config.data)
        this._maybeFetch();
    }
    async _maybeFetch() {
      const id = this._config.entity;
      if (!this.hass || this._fetchedFor === id || !this.hass.callWS)
        return;
      this._fetchedFor = id;
      const hours = this._config.hours || 24;
      const end = new Date;
      const start = new Date(end.getTime() - hours * 3600000);
      try {
        const res = await this.hass.callWS({
          type: "history/history_during_period",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          entity_ids: [id],
          minimal_response: true,
          no_attributes: true
        });
        const rows = res && res[id] || [];
        const nums = rows.map((r) => Number(r.s != null ? r.s : r.state)).filter((n) => Number.isFinite(n));
        if (nums.length)
          this._series = nums;
      } catch (_e) {}
    }
    _current() {
      const st = this._config.entity && this.hass && this.hass.states[this._config.entity];
      if (st && st.state !== "unavailable" && st.state !== "unknown") {
        const n = Number(st.state);
        if (Number.isFinite(n))
          return n;
      }
      return this._series && this._series.length ? this._series[this._series.length - 1] : null;
    }
    _unit() {
      if (this._config.unit != null)
        return this._config.unit;
      const st = this._config.entity && this.hass && this.hass.states[this._config.entity];
      return st && st.attributes.unit_of_measurement || "";
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const st = cfg.entity && this.hass && this.hass.states[cfg.entity];
      const name = cfg.name || st && st.attributes.friendly_name || cfg.entity;
      const now = this._current();
      const h = cfg.height || 46;
      const series = this._series;
      const color = cfg.color || "accent";
      const colorCls = STROKE[color] || "text-accent";
      let body;
      if (!series || series.length < 2) {
        body = html`<div
        class="flex items-center text-[11px] text-muted"
        style="height:${h}px"
      >
        Geen historie
      </div>`;
      } else {
        let min = Math.min(...series);
        let max = Math.max(...series);
        const pad = (max - min || 1) * 0.12;
        min -= pad;
        max += pad;
        const n = series.length;
        const x = (i) => i / (n - 1) * W;
        const y = (v) => h - (v - min) / (max - min || 1) * h;
        const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
        const line = "M" + pts.join(" L");
        const area = `M0,${h} L${pts.join(" L")} L${W},${h} Z`;
        body = html`<svg
        viewBox="0 0 ${W} ${h}"
        preserveAspectRatio="none"
        class="block w-full ${colorCls}"
        style="height:${h}px;overflow:visible"
      >
        <path
          d=${area}
          style="fill:currentColor;opacity:${cfg.fill === false ? 0 : 0.12}"
        ></path>
        <path
          d=${line}
          style="fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke"
        ></path>
      </svg>`;
      }
      return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-2 flex items-baseline justify-between gap-2">
        <span class="text-[11px] font-medium text-muted">${name}</span>
        <span class="text-[15px] font-semibold text-ink">
          ${now != null ? nl(now, cfg.decimals) : "—"}<span
            class="ml-0.5 text-[11px] font-medium text-ink2"
            >${this._unit()}</span
          >
        </span>
      </div>
      ${body}
      ${cfg.show_stats && series && series.length >= 2 ? html`<div
              class="mt-1.5 flex justify-between text-[9.5px] text-muted"
            >
              <span>min ${nl(Math.min(...series), cfg.decimals)}</span>
              <span>max ${nl(Math.max(...series), cfg.decimals)}</span>
            </div>` : ""}
    </div>`;
    }
    getCardSize() {
      return 2;
    }
    getLayoutOptions() {
      return { grid_columns: 6, grid_rows: 2 };
    }
  }

  // src/cards/entities.js
  var DOMAIN_ICON = {
    light: "solar:lightbulb-bold-duotone",
    switch: "solar:socket-bold-duotone",
    automation: "solar:bolt-circle-bold-duotone",
    sensor: "solar:widget-bold-duotone",
    binary_sensor: "solar:widget-bold-duotone",
    person: "solar:user-bold-duotone",
    media_player: "solar:speaker-bold-duotone"
  };
  var num = (s) => parseFloat(String(s).replace(",", "."));
  function ago(iso) {
    const t = Date.parse(iso);
    if (isNaN(t))
      return "";
    const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 60)
      return `${mins} min geleden`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24)
      return `${hrs} uur geleden`;
    return `${Math.round(hrs / 24)} dagen geleden`;
  }
  function matches(st, f) {
    if (f.domain && !st.entity_id.startsWith(f.domain + "."))
      return false;
    if (f.entity_id && !new RegExp(f.entity_id).test(st.entity_id))
      return false;
    if (f.state != null) {
      const want = Array.isArray(f.state) ? f.state : [f.state];
      if (!want.map(String).includes(String(st.state)))
        return false;
    }
    if (f.state_not != null) {
      const no = Array.isArray(f.state_not) ? f.state_not : [f.state_not];
      if (no.map(String).includes(String(st.state)))
        return false;
    }
    if (f.attributes) {
      for (const [k, v] of Object.entries(f.attributes)) {
        if (String((st.attributes || {})[k]) !== String(v))
          return false;
      }
    }
    if (f.below != null && !(num(st.state) < f.below))
      return false;
    if (f.above != null && !(num(st.state) > f.above))
      return false;
    if (f.stale_hours != null) {
      const t = Date.parse(st.last_changed);
      if (isNaN(t) || (Date.now() - t) / 3600000 < f.stale_hours)
        return false;
    }
    return true;
  }

  class FibbersEntities extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-entities",
        title: "Onbereikbaar",
        filters: [{ domain: "light", state: ["unavailable", "unknown"] }]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.filters) || !config.filters.length) {
        throw new Error("fibbers-entities: `filters` must be a non-empty list");
      }
      this._config = config;
    }
    _matched() {
      const hass = this.hass;
      if (!hass)
        return [];
      const exclude = this._config.exclude || [];
      const seen = new Set;
      const out = [];
      for (const st of Object.values(hass.states)) {
        if (!this._config.filters.some((f) => matches(st, f)))
          continue;
        if (exclude.some((f) => matches(st, f)))
          continue;
        if (seen.has(st.entity_id))
          continue;
        seen.add(st.entity_id);
        out.push(st);
      }
      if (this._config.sort === "last_changed") {
        out.sort((a, b) => Date.parse(a.last_changed) - Date.parse(b.last_changed));
      } else {
        out.sort((a, b) => this._name(a).localeCompare(this._name(b), "nl"));
      }
      const max = this._config.max;
      return max ? out.slice(0, max) : out;
    }
    _name(st) {
      return st.attributes && st.attributes.friendly_name || st.entity_id;
    }
    _icon(st) {
      if (st.attributes && st.attributes.icon)
        return st.attributes.icon;
      if ((st.attributes || {}).device_class === "battery")
        return "solar:battery-low-bold-duotone";
      return DOMAIN_ICON[st.entity_id.split(".")[0]] || "solar:widget-bold-duotone";
    }
    _secondary(st) {
      const s = this._config.secondary || "state";
      if (s === "last_changed")
        return ago(st.last_changed);
      if (s.startsWith("attribute:")) {
        const k = s.slice("attribute:".length);
        return String((st.attributes || {})[k] ?? "");
      }
      const u = (st.attributes || {}).unit_of_measurement;
      return u ? `${st.state} ${u}` : st.state;
    }
    _moreInfo(entity) {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: entity },
        bubbles: true,
        composed: true
      }));
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const rows = this._matched();
      return html`<div
      class="rounded-[14px] border border-line bg-card px-1 py-1.5"
    >
      ${cfg.title ? html`<div
              class="flex items-center gap-[7px] px-2.5 pb-1.5 pt-[7px] text-[10px]
                   font-semibold uppercase tracking-[0.08em] text-muted"
            >
              ${cfg.icon ? html`<fib-icon
                      class="h-3.5 w-3.5 [--mdc-icon-size:14px] text-muted"
                      icon=${cfg.icon}
                    ></fib-icon>` : ""}
              <span>${cfg.title}</span>
            </div>` : ""}
      ${rows.length ? rows.map((st) => html`<div
                  role="button"
                  class="grid cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-x-2.5
                     rounded-[10px] px-2.5 py-2 hover:bg-card2"
                  @click=${() => this._moreInfo(st.entity_id)}
                >
                  <div
                    class="flex h-7 w-7 items-center justify-center rounded-lg bg-card2"
                  >
                    <fib-icon
                      class="h-4 w-4 [--mdc-icon-size:16px] text-muted"
                      icon=${this._icon(st)}
                    ></fib-icon>
                  </div>
                  <span
                    class="overflow-hidden text-ellipsis whitespace-nowrap text-[12px]
                       font-medium text-ink"
                    >${this._name(st)}</span
                  >
                  <span class="whitespace-nowrap text-[10.5px] text-muted"
                    >${this._secondary(st)}</span
                  >
                </div>`) : cfg.empty ? html`<div
                class="flex items-center gap-[7px] px-2.5 py-3 text-[11.5px] text-muted"
              >
                <fib-icon
                  class="h-[15px] w-[15px] [--mdc-icon-size:15px] text-green"
                  icon="solar:check-circle-bold-duotone"
                ></fib-icon>
                <span>${cfg.empty}</span>
              </div>` : ""}
    </div>`;
    }
    getCardSize() {
      return 2;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 2 };
    }
  }

  // src/cards/presence.js
  class FibbersPresence extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return { type: "custom:fibbers-presence" };
    }
    setConfig(config) {
      if (config && config.people != null && !Array.isArray(config.people)) {
        throw new Error("fibbers-presence: `people` must be a list of entities");
      }
      this._config = config || {};
    }
    _people() {
      if (Array.isArray(this._config.people))
        return this._config.people;
      if (!this.hass)
        return [];
      return Object.keys(this.hass.states).filter((id) => id.startsWith("person.")).sort();
    }
    _isHome(st) {
      return st && st.state === "home";
    }
    _stateLabel(st) {
      if (!st)
        return "—";
      if (st.state === "home")
        return "Thuis";
      if (st.state === "not_home")
        return "Weg";
      return st.state;
    }
    _moreInfo(entity) {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: entity },
        bubbles: true,
        composed: true
      }));
    }
    render() {
      const people = this._people();
      const homeCount = people.filter((id) => this._isHome(this.hass && this.hass.states[id])).length;
      return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-2.5 flex items-baseline justify-between gap-2">
        ${this._config.title === false ? "" : html`<span
                class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                >Aanwezigheid</span
              >`}
        <span
          class="text-[12px] font-semibold ${homeCount === 0 ? "text-muted" : "text-ink"}"
          >${homeCount === 0 ? "Niemand thuis" : `${homeCount} thuis`}</span
        >
      </div>
      <div class="flex flex-wrap gap-2">
        ${people.map((id) => {
        const st = this.hass && this.hass.states[id];
        const home = this._isHome(st);
        const pic = st && st.attributes && st.attributes.entity_picture;
        return html`<button
            type="button"
            class="flex items-center gap-2 rounded-full border py-[7px] pl-[7px] pr-[11px]
                   ${home ? "border-accentline bg-accentbg" : "border-line bg-card2"}"
            @click=${() => this._moreInfo(id)}
          >
            <div
              class="flex h-[26px] w-[26px] flex-none items-center justify-center
                     overflow-hidden rounded-full bg-card bg-cover bg-center"
              style=${pic ? `background-image:url("${pic}")` : ""}
            >
              ${pic ? "" : html`<fib-icon
                      class="h-[15px] w-[15px] [--mdc-icon-size:15px] ${home ? "text-accent" : "text-muted"}"
                      icon="solar:user-bold-duotone"
                    ></fib-icon>`}
            </div>
            <div class="flex flex-col leading-[1.25]">
              <span class="text-[12px] font-semibold text-ink"
                >${st && st.attributes && st.attributes.friendly_name || id.split(".")[1]}</span
              >
              <span class="text-[10px] ${home ? "text-accenttx" : "text-muted"}"
                >${this._stateLabel(st)}</span
              >
            </div>
          </button>`;
      })}
      </div>
    </div>`;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/backup.js
  var isUnavail2 = (st) => !st || st.state === "unavailable" || st.state === "unknown";
  function ago2(iso) {
    const t = Date.parse(iso);
    if (isNaN(t))
      return { text: String(iso), hours: 0 };
    const hours = (Date.now() - t) / 3600000;
    const mins = Math.round(hours * 60);
    let text;
    if (mins < 60)
      text = `${mins} min geleden`;
    else if (hours < 24)
      text = `${Math.round(hours)} uur geleden`;
    else
      text = `${Math.round(hours / 24)} dagen geleden`;
    return { text, hours };
  }
  var clock = (iso) => {
    const t = Date.parse(iso);
    if (isNaN(t))
      return String(iso);
    return new Date(t).toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  class FibbersBackup extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return { type: "custom:fibbers-backup", entity: "sensor.backup_last" };
    }
    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("fibbers-backup: `entity` (last-backup timestamp) is required");
      }
      this._config = config;
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const st = this.hass && this.hass.states[cfg.entity];
      let value, sub, warn;
      if (isUnavail2(st)) {
        value = "—";
        sub = "Geen back-up gevonden";
        warn = true;
      } else {
        const a = ago2(st.state);
        const stale = a.hours > (cfg.stale_hours != null ? cfg.stale_hours : 26);
        let failed = false;
        if (cfg.result) {
          const r = this.hass.states[cfg.result];
          failed = r && ["off", "failed", "error", "false"].includes(String(r.state));
        }
        value = a.text;
        const bits = [failed ? "Mislukt" : "Geslaagd"];
        if (cfg.next) {
          const n = this.hass.states[cfg.next];
          if (n && !isUnavail2(n))
            bits.push(`volgende ${clock(n.state)}`);
        }
        sub = bits.join(" · ");
        warn = stale || failed;
      }
      return html`<div
      class="grid grid-cols-[34px_1fr] items-center gap-x-[11px] gap-y-0.5
             rounded-[14px] border p-[13px]
             ${warn ? "border-amberline bg-amberbg" : "border-line bg-card"}"
    >
      <div
        class="row-span-2 flex h-[34px] w-[34px] items-center justify-center rounded-[10px]
               ${warn ? "bg-amberbg" : "bg-accentbg"}"
      >
        <fib-icon
          class="h-[19px] w-[19px] [--mdc-icon-size:19px] ${warn ? "text-amber" : "text-accent"}"
          icon="solar:diskette-bold-duotone"
        ></fib-icon>
      </div>
      <div class="text-[11px] font-medium text-muted">
        ${cfg.name || "Back-up"}
      </div>
      <div class="text-[17px] font-semibold leading-[1.15] text-ink">
        ${value}
      </div>
      <div
        class="col-start-2 text-[10.5px] ${warn ? "text-ambertx" : "text-muted"}"
      >
        ${sub}
      </div>
    </div>`;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: 6, grid_rows: 1 };
    }
  }

  // src/cards/weather.js
  var COND_ICON = {
    "clear-night": "solar:moon-bold-duotone",
    sunny: "solar:sun-bold-duotone",
    partlycloudy: "solar:cloud-sun-bold-duotone",
    cloudy: "solar:cloud-bold-duotone",
    fog: "solar:cloud-bold-duotone",
    rainy: "solar:cloud-rain-bold-duotone",
    pouring: "solar:cloud-rain-bold-duotone",
    "lightning-rainy": "solar:cloud-rain-bold-duotone",
    lightning: "solar:cloud-rain-bold-duotone",
    snowy: "solar:cloud-bold-duotone",
    "snowy-rainy": "solar:cloud-rain-bold-duotone",
    hail: "solar:cloud-rain-bold-duotone",
    windy: "solar:cloud-bold-duotone",
    "windy-variant": "solar:cloud-bold-duotone",
    exceptional: "solar:cloud-bold-duotone"
  };
  var COND_NL = {
    "clear-night": "Helder",
    sunny: "Zonnig",
    partlycloudy: "Half bewolkt",
    cloudy: "Bewolkt",
    fog: "Mist",
    rainy: "Regen",
    pouring: "Stortregen",
    "lightning-rainy": "Onweer",
    lightning: "Onweer",
    snowy: "Sneeuw",
    "snowy-rainy": "Natte sneeuw",
    hail: "Hagel",
    windy: "Winderig",
    "windy-variant": "Winderig",
    exceptional: "Extreem"
  };
  var iconFor = (c) => COND_ICON[c] || "solar:cloud-bold-duotone";
  var round = (n) => Number.isFinite(Number(n)) ? Math.round(Number(n)) : null;
  var dayNl = (iso) => {
    const t = Date.parse(iso);
    if (isNaN(t))
      return "";
    return new Date(t).toLocaleDateString("nl-NL", { weekday: "short" }).replace(".", "");
  };

  class FibbersWeather extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return { type: "custom:fibbers-weather", entity: "weather.thuis" };
    }
    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("fibbers-weather: `entity` (a weather.* entity) is required");
      }
      this._config = config;
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const st = this.hass && this.hass.states[cfg.entity];
      if (!st)
        return html`<div
        class="rounded-[14px] border border-line bg-card p-[13px] text-[12px] text-muted"
      >
        Niet beschikbaar
      </div>`;
      const a = st.attributes || {};
      const days = (a.forecast || []).slice(0, cfg.days || 5);
      return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="flex items-center gap-3">
        <div
          class="flex h-[42px] w-[42px] flex-none items-center justify-center"
        >
          <fib-icon
            class="h-[34px] w-[34px] [--mdc-icon-size:34px] text-accent"
            icon=${iconFor(st.state)}
          ></fib-icon>
        </div>
        <div>
          <div class="text-[26px] font-semibold leading-none text-ink">
            ${round(a.temperature) ?? "—"}<span
              class="text-[14px] font-medium text-ink2"
              >°</span
            >
          </div>
          <div class="text-[12px] text-ink2">
            ${COND_NL[st.state] || st.state}
          </div>
        </div>
        <div class="ml-auto text-right">
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted"
            >${cfg.name || a.friendly_name || "Weer"}</span
          >
        </div>
      </div>
      ${days.length ? html`<div class="mt-3 grid auto-cols-fr grid-flow-col gap-1">
              ${days.map((f) => html`<div
                    class="flex flex-col items-center gap-1 rounded-[10px] bg-card2 px-0.5 py-2"
                  >
                    <span class="text-[10px] capitalize text-muted"
                      >${f.datetime ? dayNl(f.datetime) : ""}</span
                    >
                    <fib-icon
                      class="h-[18px] w-[18px] [--mdc-icon-size:18px] text-ink2"
                      icon=${iconFor(f.condition)}
                    ></fib-icon>
                    <span class="text-[11.5px] font-semibold text-ink"
                      >${round(f.temperature) != null ? round(f.temperature) + "°" : ""}</span
                    >
                    <span class="text-[10px] text-muted"
                      >${round(f.templow) != null ? round(f.templow) + "°" : ""}</span
                    >
                  </div>`)}
            </div>` : ""}
    </div>`;
    }
    getCardSize() {
      return 2;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 2 };
    }
  }

  // src/cards/media.js
  var clamp2 = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  class FibbersMedia extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true },
      _dragging: { state: true },
      _dragVol: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-media",
        entity: "media_player.woonkamer_spotify"
      };
    }
    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("fibbers-media: `entity` (a media_player.*) is required");
      }
      if (config.sources != null && !Array.isArray(config.sources)) {
        throw new Error("fibbers-media: `sources` must be a list");
      }
      this._config = config;
      this._dragging = false;
      this._dragVol = 0;
    }
    _st() {
      return this.hass && this.hass.states[this._config.entity];
    }
    _playing() {
      const st = this._st();
      return st && st.state === "playing";
    }
    _idle() {
      const st = this._st();
      return !st || ["off", "idle", "standby", "unavailable"].includes(st.state);
    }
    _vol() {
      if (this._dragging)
        return this._dragVol;
      const st = this._st();
      const v = st && st.attributes.volume_level;
      return v != null ? Math.round(v * 100) : 0;
    }
    _svc(service, data) {
      if (this.hass)
        this.hass.callService("media_player", service, {
          entity_id: this._config.entity,
          ...data
        });
    }
    _volFromX(clientX, track) {
      const r = track.getBoundingClientRect();
      return Math.round(clamp2((clientX - r.left) / r.width * 100, 0, 100));
    }
    _down(e) {
      this._dragging = true;
      e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
      this._dragVol = this._volFromX(e.clientX, e.currentTarget);
    }
    _move(e) {
      if (this._dragging)
        this._dragVol = this._volFromX(e.clientX, e.currentTarget);
    }
    _up(e) {
      if (!this._dragging)
        return;
      const v = this._volFromX(e.clientX, e.currentTarget);
      this._dragging = false;
      this._svc("volume_set", { volume_level: v / 100 });
    }
    _transportBtn(icon, service, big = false) {
      return html`<button
      type="button"
      class="flex ${big ? "h-11 w-11" : "h-9 w-9"} items-center justify-center rounded-full
             bg-card2 text-ink transition-transform active:scale-90"
      @click=${() => this._svc(service)}
    >
      <fib-icon
        class="${big ? "h-6 w-6 [--mdc-icon-size:24px]" : "h-[18px] w-[18px] [--mdc-icon-size:18px]"}"
        icon=${icon}
      ></fib-icon>
    </button>`;
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const st = this._st();
      const a = st && st.attributes || {};
      const idle = this._idle();
      const title = idle ? "Niets aan het spelen" : a.media_title || a.friendly_name || cfg.name || "Media";
      const artist = idle ? "" : a.media_artist || a.app_name || "";
      const art = a.entity_picture || a.media_image_url;
      const playIcon = this._playing() ? "solar:pause-bold-duotone" : "solar:play-bold-duotone";
      const artBox = html`<div
      class="flex ${cfg.compact ? "h-11 w-11" : "h-14 w-14"} flex-none items-center
             justify-center overflow-hidden rounded-xl bg-card2 bg-cover bg-center"
      style=${art ? `background-image:url("${art}")` : ""}
    >
      ${art ? "" : html`<fib-icon
              class="h-6 w-6 [--mdc-icon-size:24px] text-muted"
              icon="solar:music-note-bold-duotone"
            ></fib-icon>`}
    </div>`;
      if (cfg.compact) {
        return html`<div
        class="flex items-center gap-3 rounded-[14px] border border-line bg-card p-3"
      >
        ${artBox}
        <div class="min-w-0 flex-1">
          <div class="truncate text-[13px] font-semibold text-ink">
            ${title}
          </div>
          <div class="truncate text-[11px] text-muted">${artist}</div>
        </div>
        ${this._transportBtn(playIcon, "media_play_pause")}
        ${this._transportBtn("solar:skip-next-bold-duotone", "media_next_track")}
      </div>`;
      }
      return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-3 flex items-center gap-3">
        ${artBox}
        <div class="min-w-0 flex-1">
          ${cfg.name ? html`<div
                  class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted"
                >
                  ${cfg.name}
                </div>` : ""}
          <div class="truncate text-[15px] font-semibold text-ink">
            ${title}
          </div>
          <div class="truncate text-[12px] text-muted">${artist}</div>
        </div>
      </div>

      <div class="mb-3 flex items-center justify-center gap-4">
        ${this._transportBtn("solar:skip-previous-bold-duotone", "media_previous_track")}
        ${this._transportBtn(playIcon, "media_play_pause", true)}
        ${this._transportBtn("solar:skip-next-bold-duotone", "media_next_track")}
      </div>

      <div class="mb-1 flex items-center gap-2.5">
        <fib-icon
          class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted"
          icon="solar:volume-small-bold-duotone"
        ></fib-icon>
        <div
          class="relative h-1.5 flex-1 cursor-pointer touch-none rounded-[3px] bg-[#2C3639]"
          @pointerdown=${this._down}
          @pointermove=${this._move}
          @pointerup=${this._up}
          @pointercancel=${() => this._dragging = false}
        >
          <div
            class="absolute bottom-0 left-0 top-0 rounded-[3px] bg-accent"
            style="width:${this._vol()}%"
          ></div>
          <div
            class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full
                   bg-accent shadow-[0_1px_3px_rgba(0,0,0,.4)]"
            style="left:${this._vol()}%"
          ></div>
        </div>
        <fib-icon
          class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted"
          icon="solar:volume-loud-bold-duotone"
        ></fib-icon>
      </div>

      ${Array.isArray(cfg.sources) && cfg.sources.length ? html`<div class="mt-3 flex flex-wrap gap-[7px]">
              ${cfg.sources.map((s) => {
        const active = st && st.attributes.source === (s.source || s.name);
        return html`<button
                  type="button"
                  class="inline-flex items-center rounded-full border px-2.5 py-[5px] text-[10.5px]
                       font-medium ${active ? "border-accentline bg-accentbg text-accent" : "border-line bg-card2 text-ink2"}"
                  @click=${() => this._svc("select_source", { source: s.source || s.name })}
                >
                  ${s.name}
                </button>`;
      })}
            </div>` : ""}
    </div>`;
    }
    getCardSize() {
      return 3;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 3 };
    }
  }

  // src/cards/sysmon.js
  var W2 = 300;
  var nl2 = (n, d2) => Number.isFinite(n) ? n.toLocaleString("nl-NL", d2 != null ? { minimumFractionDigits: d2, maximumFractionDigits: d2 } : {}) : String(n);

  class FibbersSysmon extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true },
      _series: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-sysmon",
        title: "Raspberry Pi",
        metrics: [
          { label: "CPU", entity: "sensor.cpu_percent", unit: "%" },
          { label: "Temp", entity: "sensor.cpu_temp", unit: "°C" }
        ]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.metrics) || !config.metrics.length) {
        throw new Error("fibbers-sysmon: `metrics` must be a non-empty list");
      }
      this._config = config;
      this._series = null;
      this._fetchedFor = null;
    }
    updated(changed) {
      if (changed.has("hass") && this._config.graph)
        this._maybeFetch();
    }
    async _maybeFetch() {
      const id = this._config.graph;
      if (!this.hass || this._fetchedFor === id || !this.hass.callWS)
        return;
      this._fetchedFor = id;
      const hours = this._config.graph_hours || 24;
      const end = new Date;
      const start = new Date(end.getTime() - hours * 3600000);
      try {
        const res = await this.hass.callWS({
          type: "history/history_during_period",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          entity_ids: [id],
          minimal_response: true,
          no_attributes: true
        });
        const nums = (res && res[id] || []).map((r) => Number(r.s != null ? r.s : r.state)).filter((n) => Number.isFinite(n));
        if (nums.length)
          this._series = nums;
      } catch (_e) {}
    }
    _val(m) {
      const st = this.hass && this.hass.states[m.entity];
      if (!st || st.state === "unavailable" || st.state === "unknown")
        return { text: "—", unit: "" };
      const unit = m.unit != null ? m.unit : st.attributes.unit_of_measurement || "";
      return { text: nl2(Number(st.state), m.decimals) || st.state, unit };
    }
    _sparkline() {
      const series = this._series;
      if (!series || series.length < 2)
        return "";
      const h = 40;
      let min = Math.min(...series), max = Math.max(...series);
      const pad = (max - min || 1) * 0.12;
      min -= pad;
      max += pad;
      const n = series.length;
      const pts = series.map((v, i) => `${(i / (n - 1) * W2).toFixed(1)},${(h - (v - min) / (max - min || 1) * h).toFixed(1)}`);
      return html`<svg
      viewBox="0 0 ${W2} ${h}"
      preserveAspectRatio="none"
      class="mt-3 block w-full text-blue"
      style="height:${h}px"
    >
      <path
        d="M0,${h} L${pts.join(" L")} L${W2},${h} Z"
        style="fill:currentColor;opacity:.12"
      ></path>
      <path
        d="M${pts.join(" L")}"
        style="fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke"
      ></path>
    </svg>`;
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      ${cfg.title ? html`<div
              class="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
            >
              ${cfg.title}
            </div>` : ""}
      <div class="grid grid-cols-2 gap-2">
        ${cfg.metrics.map((m) => {
        const v = this._val(m);
        return html`<div
            class="flex items-center gap-2.5 rounded-[10px] bg-card2 px-2.5 py-2"
          >
            <fib-icon
              class="h-[18px] w-[18px] flex-none [--mdc-icon-size:18px] text-muted"
              icon=${m.icon || "solar:widget-bold-duotone"}
            ></fib-icon>
            <div class="min-w-0">
              <div class="text-[10px] text-muted">${m.label || m.entity}</div>
              <div class="text-[15px] font-semibold text-ink">
                ${v.text}<span class="ml-0.5 text-[10px] font-medium text-ink2"
                  >${v.unit}</span
                >
              </div>
            </div>
          </div>`;
      })}
      </div>
      ${this._sparkline()}
    </div>`;
    }
    getCardSize() {
      return 3;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 3 };
    }
  }

  // src/cards/scheduler.js
  var hhmm = (s) => typeof s === "string" ? s.slice(0, 5) : "";
  var addMinutes = (s, mins) => {
    const [h, m] = hhmm(s).split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m))
      return "";
    const t = (h * 60 + m + Math.round(mins)) % (24 * 60);
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };

  class FibbersScheduler extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return {
        type: "custom:fibbers-scheduler",
        name: "Wekker",
        time: "input_datetime.wake_time",
        enable: "input_boolean.wake_enabled"
      };
    }
    setConfig(config) {
      if (!config || !config.time) {
        throw new Error("fibbers-scheduler: `time` (an input_datetime) is required");
      }
      this._config = config;
    }
    _state(id) {
      return id && this.hass ? this.hass.states[id] : null;
    }
    _moreInfo(entity) {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: entity },
        bubbles: true,
        composed: true
      }));
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const timeSt = this._state(cfg.time);
      const time = hhmm(timeSt && timeSt.state);
      const enSt = this._state(cfg.enable);
      const on = enSt ? enSt.state === "on" : true;
      const durSt = this._state(cfg.duration);
      const dur = durSt ? Number(durSt.state) : null;
      const windowEnd = dur ? addMinutes(time, dur) : "";
      return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-2 flex items-center gap-2">
        <fib-icon
          class="h-4 w-4 [--mdc-icon-size:16px] ${on ? "text-accent" : "text-muted"}"
          icon="solar:alarm-bold-duotone"
        ></fib-icon>
        <span
          class="flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
          >${cfg.name || "Wekker"}</span
        >
        ${cfg.enable ? html`<button
                type="button"
                class="relative h-5 w-9 flex-none rounded-full transition-colors
                     ${on ? "bg-accent" : "bg-card2"}"
                role="switch"
                aria-checked=${on}
                @click=${() => this.hass.callService("input_boolean", "toggle", {
        entity_id: cfg.enable
      })}
              >
                <span
                  class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all
                       ${on ? "left-[18px]" : "left-0.5"}"
                ></span>
              </button>` : ""}
      </div>

      <button
        type="button"
        class="text-left ${on ? "" : "opacity-50"}"
        @click=${() => this._moreInfo(cfg.time)}
      >
        <span class="text-[30px] font-semibold leading-none text-ink"
          >${time || "—"}</span
        >
        ${windowEnd ? html`<span class="ml-2 text-[13px] text-muted"
                >→ ${windowEnd}${dur ? html` · ${dur} min` : ""}</span
              >` : ""}
      </button>

      ${Array.isArray(cfg.days) && cfg.days.length ? html`<div class="mt-3 flex flex-wrap gap-1.5">
              ${cfg.days.map((d2) => {
        const obj = typeof d2 === "object";
        const st = obj ? this._state(d2.entity) : null;
        const active = obj ? st && st.state === "on" : true;
        return html`<button
                  type="button"
                  class="rounded-full border px-2.5 py-1 text-[10.5px] font-medium
                       ${active ? "border-accentline bg-accentbg text-accent" : "border-line bg-card2 text-ink2"}"
                  @click=${() => obj && this.hass.callService("input_boolean", "toggle", {
          entity_id: d2.entity
        })}
                >
                  ${obj ? d2.name : d2}
                </button>`;
      })}
            </div>` : ""}
    </div>`;
    }
    getCardSize() {
      return 2;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 2 };
    }
  }

  // src/cards/remote.js
  var DEFAULTS = {
    power: "POWER",
    up: "DPAD_UP",
    down: "DPAD_DOWN",
    left: "DPAD_LEFT",
    right: "DPAD_RIGHT",
    ok: "DPAD_CENTER",
    back: "BACK",
    home: "HOME",
    menu: "MENU",
    volume_up: "VOLUME_UP",
    volume_down: "VOLUME_DOWN",
    play: "MEDIA_PLAY_PAUSE"
  };

  class FibbersRemote extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return { type: "custom:fibbers-remote", entity: "remote.woonkamer_tv" };
    }
    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("fibbers-remote: `entity` (a remote.*) is required");
      }
      this._config = config;
    }
    _send(key) {
      const cmd = (this._config.commands || {})[key] || DEFAULTS[key];
      if (cmd && this.hass)
        this.hass.callService("remote", "send_command", {
          entity_id: this._config.entity,
          command: cmd
        });
    }
    _btn(key, icon, opts = {}) {
      const round2 = opts.round !== false;
      const accent = opts.accent;
      return html`<button
      type="button"
      class="flex items-center justify-center ${round2 ? "rounded-full" : "rounded-xl"} ${opts.size || "h-11 w-11"}
             ${accent ? "bg-accentbg text-accent" : "bg-card2 text-ink"}
             transition-transform active:scale-90"
      @click=${() => this._send(key)}
      aria-label=${key}
    >
      <fib-icon
        class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      return html`<div
      class="flex flex-col items-center gap-3 rounded-[14px] border border-line bg-card p-[13px]"
    >
      <div class="flex w-full items-center justify-between">
        <span
          class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
          >${cfg.name || "Afstandsbediening"}</span
        >
        ${this._btn("power", "solar:power-bold-duotone", {
        size: "h-9 w-9",
        accent: true
      })}
      </div>

      <!-- D-pad -->
      <div class="grid grid-cols-3 gap-2">
        <span></span>
        ${this._btn("up", "solar:alt-arrow-up-bold-duotone")}
        <span></span>
        ${this._btn("left", "solar:alt-arrow-left-bold-duotone")}
        ${this._btn("ok", "solar:record-circle-bold-duotone", { accent: true })}
        ${this._btn("right", "solar:alt-arrow-right-bold-duotone")}
        <span></span>
        ${this._btn("down", "solar:alt-arrow-down-bold-duotone")}
        <span></span>
      </div>

      <div class="flex gap-2">
        ${this._btn("back", "solar:alt-arrow-left-bold-duotone", { size: "h-9 w-9" })}
        ${this._btn("home", "solar:home-2-bold-duotone", { size: "h-9 w-9" })}
        ${this._btn("menu", "solar:menu-dots-bold-duotone", { size: "h-9 w-9" })}
      </div>

      <div class="flex gap-2">
        ${this._btn("volume_down", "solar:volume-small-bold-duotone", { size: "h-9 w-9" })}
        ${this._btn("play", "solar:play-bold-duotone", { size: "h-9 w-9" })}
        ${this._btn("volume_up", "solar:volume-loud-bold-duotone", { size: "h-9 w-9" })}
      </div>
    </div>`;
    }
    getCardSize() {
      return 4;
    }
    getLayoutOptions() {
      return { grid_columns: 6, grid_rows: 4 };
    }
  }

  // src/cards/climate.js
  var MODE = {
    heat: { icon: "solar:fire-bold-duotone", label: "Verwarmen" },
    cool: { icon: "solar:snowflake-bold-duotone", label: "Koelen" },
    fan_only: { icon: "solar:wind-bold-duotone", label: "Ventilator" },
    auto: { icon: "solar:temperature-bold-duotone", label: "Auto" },
    heat_cool: { icon: "solar:temperature-bold-duotone", label: "Auto" },
    dry: { icon: "solar:wind-bold-duotone", label: "Drogen" },
    off: { icon: "solar:power-bold-duotone", label: "Uit" }
  };
  var ACTION_NL = {
    heating: "Verwarmt",
    cooling: "Koelt",
    drying: "Droogt",
    fan: "Ventileert",
    idle: "Inactief",
    off: "Uit"
  };

  class FibbersClimate extends LitElement {
    static properties = {
      hass: { attribute: false },
      _config: { state: true }
    };
    static styles = [
      twSheet,
      css`
      :host {
        display: block;
      }
    `
    ];
    static getStubConfig() {
      return { type: "custom:fibbers-climate", entity: "climate.woonkamer" };
    }
    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("fibbers-climate: `entity` (a climate.*) is required");
      }
      this._config = config;
    }
    _st() {
      return this.hass && this.hass.states[this._config.entity];
    }
    _bump(delta) {
      const st = this._st();
      if (!st)
        return;
      const step = st.attributes.target_temp_step || 0.5;
      const cur = Number(st.attributes.temperature);
      if (!Number.isFinite(cur))
        return;
      const min = st.attributes.min_temp ?? 5;
      const max = st.attributes.max_temp ?? 35;
      const next = Math.min(max, Math.max(min, Math.round((cur + delta * step) * 10) / 10));
      this.hass.callService("climate", "set_temperature", {
        entity_id: this._config.entity,
        temperature: next
      });
    }
    render() {
      const cfg = this._config;
      if (!cfg)
        return html``;
      const st = this._st();
      if (!st)
        return html`<div
        class="rounded-[14px] border border-line bg-card p-[13px] text-[12px] text-muted"
      >
        Niet beschikbaar
      </div>`;
      const a = st.attributes;
      const cur = a.current_temperature;
      const target = a.temperature;
      const modes = (a.hvac_modes || []).filter((m) => MODE[m]);
      const action = a.hvac_action;
      return html`<div class="rounded-[14px] border border-line bg-card p-[13px]">
      <div class="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <div
            class="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted"
          >
            ${cfg.name || a.friendly_name || "Thermostaat"}
          </div>
          <div class="text-[24px] font-semibold leading-none text-ink">
            ${cur != null ? cur : "—"}<span class="text-[14px] text-ink2"
              >°</span
            >
          </div>
        </div>
        <span class="text-[11px] text-muted"
          >${ACTION_NL[action] || (st.state !== "off" ? "Aan" : "Uit")}</span
        >
      </div>

      <div class="mb-3 flex items-center justify-center gap-4">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-ink
                 transition-transform active:scale-90"
          @click=${() => this._bump(-1)}
        >
          <fib-icon
            class="h-6 w-6 [--mdc-icon-size:24px]"
            icon="solar:minus-circle-bold-duotone"
          ></fib-icon>
        </button>
        <div class="min-w-[68px] text-center">
          <div class="text-[26px] font-semibold leading-none text-accent">
            ${target != null ? target : "—"}<span class="text-[14px]">°</span>
          </div>
          <div
            class="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-muted"
          >
            Ingesteld
          </div>
        </div>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-ink
                 transition-transform active:scale-90"
          @click=${() => this._bump(1)}
        >
          <fib-icon
            class="h-6 w-6 [--mdc-icon-size:24px]"
            icon="solar:add-circle-bold-duotone"
          ></fib-icon>
        </button>
      </div>

      ${modes.length ? html`<div class="flex flex-wrap justify-center gap-[7px]">
              ${modes.map((m) => {
        const active = st.state === m;
        return html`<button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px]
                       text-[10.5px] font-medium ${active ? "border-accentline bg-accentbg text-accent" : "border-line bg-card2 text-ink2"}"
                  @click=${() => this.hass.callService("climate", "set_hvac_mode", {
          entity_id: cfg.entity,
          hvac_mode: m
        })}
                >
                  <fib-icon
                    class="h-[13px] w-[13px] [--mdc-icon-size:13px]"
                    icon=${MODE[m].icon}
                  ></fib-icon>
                  ${MODE[m].label}
                </button>`;
      })}
            </div>` : ""}
    </div>`;
    }
    getCardSize() {
      return 3;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 3 };
    }
  }

  // src/index.js
  /*!
   * Fibbers — custom cards + theming for the Thuis Home Assistant dashboard.
   *
   * Ships:
   *   custom:fibbers-nav    bottom navigation bar, genuinely pinned to the viewport
   *   custom:fibbers-back   back control driven by a real navigation stack
   *
   * WHY THE BAR RENDERS INTO document.body
   * Inside a Lovelace view, `position: fixed` resolves against the scrolling
   * content box rather than the window, so a bar "fixed to the bottom" lands at
   * the bottom of the page instead of the screen. Rendering into document.body is
   * the only reliable escape, and it is also what keeps the bar working
   * independent of Lovelace's own DOM. Everything else here follows from that.
   *
   * Source is modular under src/. `bun run build` bundles it into an IIFE at
   * dist/fibbers.js — edit src/, never the bundle.
   */
  var VERSION = "0.2.0";
  var CARDS = [
    [
      "fibbers-nav",
      FibbersNav,
      "Fibbers Nav",
      "Bottom navigation bar pinned to the viewport."
    ],
    [
      "fibbers-back",
      FibbersBack,
      "Fibbers Back",
      "Back control driven by a real navigation stack."
    ],
    [
      "fibbers-sheet",
      FibbersSheet,
      "Fibbers Sheet",
      "Hash-routed modal bottom sheet."
    ],
    [
      "fibbers-section",
      FibbersSection,
      "Fibbers Section",
      "Uppercase mono section label."
    ],
    [
      "fibbers-room",
      FibbersRoom,
      "Fibbers Room",
      "Room tile that computes its own light state."
    ],
    [
      "fibbers-light-row",
      FibbersLightRow,
      "Fibbers Light Row",
      "Light row with a brightness slider, for sheets."
    ],
    [
      "fibbers-alert",
      FibbersAlert,
      "Fibbers Alert",
      "Attention card driven by real checks."
    ],
    ["fibbers-chips", FibbersChips, "Fibbers Chips", "A row of action pills."],
    [
      "fibbers-scene",
      FibbersScene,
      "Fibbers Scene",
      "Scene tiles that highlight the active scene."
    ],
    [
      "fibbers-stat",
      FibbersStat,
      "Fibbers Stat",
      "Single value tile — icon, label, value and unit."
    ],
    [
      "fibbers-graph",
      FibbersGraph,
      "Fibbers Graph",
      "Single-entity sparkline of recent history."
    ],
    [
      "fibbers-entities",
      FibbersEntities,
      "Fibbers Entities",
      "Self-maintaining filtered list of entities."
    ],
    [
      "fibbers-presence",
      FibbersPresence,
      "Fibbers Presence",
      "Who's home — person tiles with a summary."
    ],
    [
      "fibbers-backup",
      FibbersBackup,
      "Fibbers Backup",
      "Backup status — last run, result and next."
    ],
    [
      "fibbers-weather",
      FibbersWeather,
      "Fibbers Weather",
      "Current conditions and a short forecast."
    ],
    [
      "fibbers-media",
      FibbersMedia,
      "Fibbers Media",
      "Media player — now-playing, transport, volume, sources."
    ],
    [
      "fibbers-sysmon",
      FibbersSysmon,
      "Fibbers Sysmon",
      "Host telemetry tiles with an optional sparkline."
    ],
    [
      "fibbers-scheduler",
      FibbersScheduler,
      "Fibbers Scheduler",
      "Wake/alarm control driven by HA helpers."
    ],
    [
      "fibbers-remote",
      FibbersRemote,
      "Fibbers Remote",
      "Universal remote — D-pad and buttons."
    ],
    [
      "fibbers-climate",
      FibbersClimate,
      "Fibbers Climate",
      "Thermostat — setpoint and hvac modes."
    ]
  ];
  CARDS.forEach(([tag2, cls]) => {
    if (!customElements.get(tag2))
      customElements.define(tag2, cls);
  });
  window.customCards = window.customCards || [];
  CARDS.forEach(([tag2, , name, description]) => {
    if (!window.customCards.some((c) => c.type === tag2)) {
      window.customCards.push({ type: tag2, name, description, preview: false });
    }
  });
  injectGlobalCss();
  window.FIBBERS = {
    VERSION,
    nav,
    goBack,
    previous,
    navigate,
    tokens: T,
    styleBlock,
    injectGlobalCss,
    bar
  };
  console.info(`%c FIBBERS %c v${VERSION} `, "color:#111516;background:#74B98A;font-weight:600;border-radius:3px 0 0 3px;padding:2px 4px", "color:#74B98A;background:#1D2426;border-radius:0 3px 3px 0;padding:2px 4px");
})();
