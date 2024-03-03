"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var create_slot_exports = {};
__export(create_slot_exports, {
  createSlot: () => createSlot
});
module.exports = __toCommonJS(create_slot_exports);
var import_react = __toESM(require("react"));
var import_effector = require("effector");
var import_effector_react = require("effector-react");
var nextSlot = 0;
function createSlot(params = {}) {
  const { name = `slot-${nextSlot++}`, domain = (0, import_effector.createDomain)(name) } = params;
  const $fills = (0, import_effector.createStore)(Array(), {
    domain,
    name: `${name}::fills`
  });
  const add = (0, import_effector.createEvent)({ domain, name: `${name}::add` });
  const set = (0, import_effector.createEvent)({ domain, name: `${name}::set` });
  const remove = (0, import_effector.createEvent)({ domain, name: `${name}::remove` });
  $fills.on(add, (list, fill) => {
    list[fill.order] = fill.node;
    return [...list];
  }).on(remove, (list, order) => {
    delete list[order];
    return [...list];
  }).on(set, (_, fills) => fills.map((fill) => fill.node));
  const PropsGate = (0, import_effector_react.createGate)({
    domain,
    name: `${name}::props_gate`
  });
  const Host = (props) => {
    const { children, ...rest } = props;
    const fills = (0, import_effector_react.useUnit)($fills);
    (0, import_effector_react.useGate)(PropsGate, rest);
    const hasFills = fills.some(Boolean);
    if (!hasFills) {
      return children;
    }
    return import_react.default.Children.map(fills, (fill, index) => {
      if (!fill) {
        return null;
      }
      return import_react.default.cloneElement(fill, {
        key: fill.key ?? index
      });
    });
  };
  let nextOrder = 0;
  const Slot = (props) => {
    const { children: node, order: forcedOrder } = props;
    const orderRef = import_react.default.useRef(forcedOrder);
    if (orderRef.current === void 0) {
      orderRef.current = nextOrder++;
    }
    (0, import_react.useLayoutEffect)(() => {
      const order = orderRef.current;
      add({ node, order });
      return () => {
        remove(order);
      };
    }, [node, orderRef]);
    return null;
  };
  Slot.Host = Host;
  Slot.useProps = () => {
    return (0, import_effector_react.useUnit)(PropsGate.state);
  };
  Slot.units = {
    add,
    remove,
    set,
    fills: $fills,
    props: PropsGate.state
  };
  return Slot;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createSlot
});
