export const enum elonColor {
    classic = 'classic',
    wario = 'wario',
    null = 'null',
}

export const enum PetType {
    elon = 'elon',
    null = 'null',
}

export const enum PetSpeed {
    still = 0,
    verySlow = 1,
    slow = 2,
    normal = 3,
    fast = 4,
    veryFast = 5,
}

export const enum elonSize {
    nano = 'nano',
    medium = 'medium',
    large = 'large',
}

export const enum ExtPosition {
    panel = 'panel',
    explorer = 'explorer',
}

export const enum Theme {
    none = 'none',
    forest = 'forest',
    castle = 'castle',
    beach = 'beach',
}

export const enum ColorThemeKind {
    light = 1,
    dark = 2,
    highContrast = 3,
}

export class WebviewMessage {
    text: string;
    command: string;

    constructor(text: string, command: string) {
        this.text = text;
        this.command = command;
    }
}

export const ALL_PETS = [
    PetType.elon,
];
export const ALL_COLORS = [
    elonColor.classic,
    elonColor.wario,
    elonColor.null,
];
export const ALL_SCALES = [elonSize.nano, elonSize.medium, elonSize.large];
export const ALL_THEMES = [Theme.none, Theme.forest, Theme.castle, Theme.beach];
