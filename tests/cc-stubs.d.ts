declare module 'cc' {
    export class Vec3 {
        public constructor(x?: number, y?: number, z?: number);
        public x: number;
        public y: number;
        public z: number;
        public clone(): Vec3;
        public add(other: Vec3): Vec3;
    }

    export class Color {
        public constructor(r?: number, g?: number, b?: number, a?: number);
    }

    export class Component {
        public readonly node: Node;
        public getComponent<T extends Component>(type: new () => T): T | null;
        public destroy(): void;
    }

    export class Node {
        public static readonly EventType: {
            TOUCH_END: string;
        };

        public constructor(name?: string);
        public readonly children: readonly Node[];
        public readonly position: Vec3;
        public addChild(child: Node): void;
        public setPosition(x: number, y: number, z?: number): void;
        public setPosition(position: Vec3): void;
        public setSiblingIndex(index: number): void;
        public setScale(x: number, y: number, z?: number): void;
        public destroy(): void;
        public removeAllChildren(): void;
        public getComponent<T extends Component>(type: new () => T): T | null;
        public addComponent<T extends Component>(type: new () => T): T;
        public on(type: string, callback: () => void, target?: unknown): void;
    }

    export class UITransform extends Component {
        public setContentSize(width: number, height: number): void;
    }

    export class Graphics extends Component {
        public lineWidth: number;
        public strokeColor: Color;
        public fillColor: Color;
        public moveTo(x: number, y: number): void;
        public lineTo(x: number, y: number): void;
        public rect(x: number, y: number, width: number, height: number): void;
        public circle(x: number, y: number, radius: number): void;
        public stroke(): void;
        public fill(): void;
    }

    export class Label extends Component {
        public static readonly HorizontalAlign: {
            CENTER: number;
        };
        public static readonly VerticalAlign: {
            CENTER: number;
        };

        public string: string;
        public fontSize: number;
        public lineHeight: number;
        public color: Color;
        public horizontalAlign: number;
        public verticalAlign: number;
    }

    export class JsonAsset {
        public readonly json: unknown;
    }

    export class Tween<T> {
        public static stopAllByTarget(target: unknown): void;
        public to(
            duration: number,
            properties: Record<string, unknown>,
            options?: { easing?: string },
        ): Tween<T>;
        public call(callback: () => void): Tween<T>;
        public start(): Tween<T>;
    }

    export function tween<T>(target: T): Tween<T>;

    export const _decorator: {
        ccclass(name: string): ClassDecorator;
        property(type?: unknown): PropertyDecorator;
    };

    export const director: {
        addPersistRootNode(node: Node): void;
    };

    export const view: {
        getVisibleSize(): { width: number; height: number };
    };

    export const resources: {
        load<T>(
            path: string,
            type: new () => T,
            callback: (error: Error | null, asset: T) => void,
        ): void;
    };

    export const sys: {
        localStorage: Storage;
    };
}
