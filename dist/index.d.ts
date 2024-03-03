import React from 'react';
import { Domain, Event, Store } from 'effector';

type Params = {
    name?: string;
    domain?: Domain;
};
type FillProps = {
    children: React.ReactElement;
    order?: Order;
};
type Order = number;
type FillPayload = {
    node: React.ReactElement;
    order: Order;
};
type RemovePayload = Order;
type EffectorUnits<Props> = {
    add: Event<FillPayload>;
    remove: Event<RemovePayload>;
    set: Event<FillPayload>;
    props: Store<Props>;
    fills: Store<Array<React.ReactElement>>;
};
type Slot<P> = React.FC<FillProps> & {
    Host: React.FC<React.PropsWithChildren<P>>;
    units: EffectorUnits<P>;
    useProps: () => P;
};
declare function createSlot<Props>(params?: Params): Slot<Props>;

export { createSlot };
