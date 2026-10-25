import { GridPoint, type GridPointData } from './GridPoint';

export interface BlockInitialData {
    id: string;
    cells: readonly GridPointData[];
}

export class Block {
    public readonly id: string;
    public readonly cells: readonly GridPoint[];

    public constructor(data: BlockInitialData) {
        this.id = data.id;
        this.cells = data.cells.map((cell) => GridPoint.from(cell));
    }

    public intersects(points: readonly GridPoint[]): boolean {
        const occupied = new Set(this.cells.map((cell) => cell.key()));
        return points.some((point) => occupied.has(point.key()));
    }
}
