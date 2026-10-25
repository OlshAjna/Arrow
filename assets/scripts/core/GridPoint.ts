export interface GridPointData {
    x: number;
    y: number;
}

export class GridPoint implements GridPointData {
    public constructor(
        public readonly x: number,
        public readonly y: number,
    ) {}

    public static from(data: GridPointData): GridPoint {
        return new GridPoint(data.x, data.y);
    }

    public translated(dx: number, dy: number): GridPoint {
        return new GridPoint(this.x + dx, this.y + dy);
    }

    public equals(other: GridPointData): boolean {
        return this.x === other.x && this.y === other.y;
    }

    public key(): string {
        return `${this.x},${this.y}`;
    }

    public clone(): GridPoint {
        return new GridPoint(this.x, this.y);
    }
}
