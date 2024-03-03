// index.ts
import React, { useLayoutEffect } from "react";
import {
  createDomain,
  createEvent,
  createStore
} from "effector";
import { createGate, useGate, useUnit } from "effector-react";
var nextSlot = 0;
function createSlot(params = {}) {
  const { name = `slot-${nextSlot++}`, domain = createDomain(name) } = params;
  const $fills = createStore(Array(), {
    domain,
    name: `${name}::fills`
  });
  const add = createEvent({ domain, name: `${name}::add` });
  const set = createEvent({ domain, name: `${name}::set` });
  const remove = createEvent({ domain, name: `${name}::remove` });
  $fills.on(add, (list, fill) => {
    list[fill.order] = fill.node;
    return [...list];
  }).on(remove, (list, order) => {
    delete list[order];
    return [...list];
  }).on(set, (_, fill) => [fill.node]);
  const PropsGate = createGate({
    domain,
    name: `${name}::props_gate`
  });
  const Host = (props) => {
    const { children, ...rest } = props;
    const fills = useUnit($fills);
    useGate(PropsGate, rest);
    const hasFills = fills.some(Boolean);
    if (!hasFills) {
      return children;
    }
    return React.Children.map(fills, (fill, index) => {
      if (!fill) {
        return null;
      }
      return React.cloneElement(fill, {
        key: fill.key ?? index
      });
    });
  };
  let nextOrder = 0;
  const Slot = (props) => {
    const { children: node, order: forcedOrder } = props;
    const orderRef = React.useRef(forcedOrder);
    if (orderRef.current === void 0) {
      orderRef.current = nextOrder++;
    }
    useLayoutEffect(() => {
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
    return useUnit(PropsGate.state);
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
export {
  createSlot
};
