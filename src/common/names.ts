import { ELON_NAMES } from '../panel/pets/elon';

export function randomName(): string {
    const collection: ReadonlyArray<string> = ELON_NAMES;

    return (
        collection[Math.floor(Math.random() * collection.length)] ?? 'Unknown'
    );
}
