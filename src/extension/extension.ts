import * as vscode from 'vscode';
import { ColorThemeKind } from 'vscode';
import {
    elonSize,
    elonColor,
    PetType,
    ExtPosition,
    Theme,
    WebviewMessage,
    ALL_COLORS,
    ALL_PETS,
    ALL_SCALES,
    ALL_THEMES,
} from '../common/types';
import { randomName } from '../common/names';
import * as localize from '../common/localize';
import { availableColors, normalizeColor } from '../panel/pets';

const happy_quotes: string[] = [
    'I made an offer.',
    'We are going to make it happen!',
    'And...we just hit another all-time high in Twitter usage lol'
]

const angry_quotes: string[] = [
    'You are fired.',
    'One word: Doge.',
    'Sometimes it’s just better to make pizza at home',
    'Technically, alcohol is a solution'
]

let errCount = 0;

const EXTRA_PETS_KEY = 'elonPet.extra-pets';
const EXTRA_PETS_KEY_TYPES = EXTRA_PETS_KEY + '.types';
const EXTRA_PETS_KEY_COLORS = EXTRA_PETS_KEY + '.colors';
const EXTRA_PETS_KEY_NAMES = EXTRA_PETS_KEY + '.names';
const DEFAULT_PET_SCALE = elonSize.large;
const DEFAULT_COLOR = elonColor.classic;
const DEFAULT_PET_TYPE = PetType.elon;
const DEFAULT_POSITION = ExtPosition.explorer;
const DEFAULT_THEME = Theme.none;

class PetQuickPickItem implements vscode.QuickPickItem {
    constructor(
        public readonly name_: string,
        public readonly type: string,
        public readonly color: string,
    ) {
        this.name = name_;
        this.label = name_;
        this.description = `${color} ${type}`;
    }

    name: string;
    label: string;
    kind?: vscode.QuickPickItemKind | undefined;
    description?: string | undefined;
    detail?: string | undefined;
    picked?: boolean | undefined;
    alwaysShow?: boolean | undefined;
    buttons?: readonly vscode.QuickInputButton[] | undefined;
}

let webviewViewProvider: PetWebviewViewProvider;
let numErrors = 0;

function getConfiguredSize(): elonSize {
    var size = vscode.workspace
        .getConfiguration('elonPet')
        .get<elonSize>('elonSize', DEFAULT_PET_SCALE);
    if (ALL_SCALES.lastIndexOf(size) === -1) {
        size = DEFAULT_PET_SCALE;
    }
    return size;
}

function getConfiguredTheme(): Theme {
    var theme = vscode.workspace
        .getConfiguration('elonPet')
        .get<Theme>('theme', DEFAULT_THEME);
    if (ALL_THEMES.lastIndexOf(theme) === -1) {
        theme = DEFAULT_THEME;
    }
    return theme;
}

function getConfiguredThemeKind(): ColorThemeKind {
    return vscode.window.activeColorTheme.kind;
}

function getConfigurationPosition() {
    return DEFAULT_POSITION;
}

function getThrowWithMouseConfiguration(): boolean {
    return false;
}

function updatePanelThrowWithMouse(): void {
    const panel = getPetPanel();
    if (panel !== undefined) {
        panel.setThrowWithMouse(getThrowWithMouseConfiguration());
    }
}

function updateExtensionPositionContext() {
    vscode.commands.executeCommand(
        'setContext',
        'elonPet.position',
        getConfigurationPosition(),
    );
}

export class PetSpecification {
    color: elonColor;
    type: PetType;
    size: elonSize;
    name: string;

    constructor(color: elonColor, type: PetType, size: elonSize, name?: string) {
        this.color = color;
        this.type = type;
        this.size = size;
        if (!name) {
            this.name = randomName();
        } else {
            this.name = name;
        }
    }

    static fromConfiguration(): PetSpecification {
        var color = vscode.workspace
            .getConfiguration('elonPet')
            .get<elonColor>('elonStyle', DEFAULT_COLOR);
        if (ALL_COLORS.lastIndexOf(color) === -1) {
            color = DEFAULT_COLOR;
        }
        var type = vscode.workspace
            .getConfiguration('elonPet')
            .get<PetType>('petType', DEFAULT_PET_TYPE);
        if (ALL_PETS.lastIndexOf(type) === -1) {
            type = DEFAULT_PET_TYPE;
        }

        return new PetSpecification(color, type, getConfiguredSize());
    }

    static collectionFromMemento(
        context: vscode.ExtensionContext,
        size: elonSize,
    ): PetSpecification[] {
        var contextTypes = context.globalState.get<PetType[]>(
            EXTRA_PETS_KEY_TYPES,
            [],
        );
        var contextColors = context.globalState.get<elonColor[]>(
            EXTRA_PETS_KEY_COLORS,
            [],
        );
        var contextNames = context.globalState.get<string[]>(
            EXTRA_PETS_KEY_NAMES,
            [],
        );
        var result: PetSpecification[] = new Array();
        for (let index = 0; index < contextTypes.length; index++) {
            result.push(
                new PetSpecification(
                    contextColors?.[index] ?? DEFAULT_COLOR,
                    contextTypes[index],
                    size,
                    contextNames[index],
                ),
            );
        }
        return result;
    }
}

export function storeCollectionAsMemento(
    context: vscode.ExtensionContext,
    collection: PetSpecification[],
) {
    var contextTypes = new Array(collection.length);
    var contextColors = new Array(collection.length);
    var contextNames = new Array(collection.length);
    for (let index = 0; index < collection.length; index++) {
        contextTypes[index] = collection[index].type;
        contextColors[index] = collection[index].color;
        contextNames[index] = collection[index].name;
    }
    context.globalState.update(EXTRA_PETS_KEY_TYPES, contextTypes);
    context.globalState.update(EXTRA_PETS_KEY_COLORS, contextColors);
    context.globalState.update(EXTRA_PETS_KEY_NAMES, contextNames);
    context.globalState.setKeysForSync([
        EXTRA_PETS_KEY_TYPES,
        EXTRA_PETS_KEY_COLORS,
        EXTRA_PETS_KEY_NAMES,
    ]);
}

let petPlaygroundStatusBar: vscode.StatusBarItem;
let spawnPetStatusBar: vscode.StatusBarItem;

interface IPetInfo {
    type: PetType;
    name: string;
    color: elonColor;
}

async function handleRemovePetMessage(
    this: vscode.ExtensionContext,
    message: WebviewMessage,
) {
    var petList: IPetInfo[] = Array();
    switch (message.command) {
        case 'list-pets':
            message.text.split('\n').forEach((pet) => {
                var parts = pet.split(',');
                petList.push({
                    type: parts[0] as PetType,
                    name: parts[1],
                    color: parts[2] as elonColor,
                });
            });
            break;
        default:
            return;
    }
    if (!petList) {
        return;
    }
    await vscode.window
        .showQuickPick<PetQuickPickItem>(
            petList.map((val) => {
                return new PetQuickPickItem(val.name, val.type, val.color);
            }),
            {
                placeHolder: vscode.l10n.t('Select an Elon to remove.'),
            },
        )
        .then((pet: PetQuickPickItem | undefined) => {
            if (pet) {
                const panel = getPetPanel();
                if (panel !== undefined) {
                    panel.deletePet(pet.name);
                    const collection = petList
                        .filter((item) => {
                            return item.name !== pet.name;
                        })
                        .map<PetSpecification>((item) => {
                            return new PetSpecification(
                                item.color,
                                item.type,
                                elonSize.medium,
                                item.name,
                            );
                        });
                    storeCollectionAsMemento(this, collection);
                }
            }
        });
}

function getPetPanel(): IPetPanel | undefined {
    if (
        getConfigurationPosition() === ExtPosition.explorer &&
        webviewViewProvider
    ) {
        return webviewViewProvider;
    } else if (PetPanel.currentPanel) {
        return PetPanel.currentPanel;
    } else {
        return undefined;
    }
}

function getWebview(): vscode.Webview | undefined {
    if (
        getConfigurationPosition() === ExtPosition.explorer &&
        webviewViewProvider
    ) {
        return webviewViewProvider.getWebview();
    } else if (PetPanel.currentPanel) {
        return PetPanel.currentPanel.getWebview();
    }
}

export function activate(context: vscode.ExtensionContext) {

    handleErrorResponse();
    
    const disposable1 = vscode.commands.registerCommand(
        'elonPet.hi', () => {
            vscode.window.showInformationMessage(
                getNumErrors().toString()
            );
        }
        );
    
    context.subscriptions.push(disposable1);

    // const createTweet = () => {
    //     const numErrors = getNumErrors();
    //     let randomQuote = '';
    //     if (numErrors > 5) {
    //         // chose a random element from ELON_QUOTES_BAD
    //         const randomIndex = Math.floor(Math.random() * bad_quotes.length);
    //         randomQuote = bad_quotes[randomIndex];
    //     } else {
    //         // chose a random element from ELON_QUOTES_GOOD
    //         const randomIndex = Math.floor(Math.random() * good_quotes.length);
    //         randomQuote = good_quotes[randomIndex];
    //     }
    //     return numErrors + ' errors!! ' + randomQuote;
    // };

    // const tweety = vscode.commands.registerCommand(
    //     'elonPet.tweet', () => {
    //         const tweet = createTweet();
    //         vscode.window.showInformationMessage(
    //             tweet
    //         );
    //     }
    // );

    // assign a random number between 20 and 100 to the variable seconds
    const seconds = 10;

    setInterval(() => {
        vscode.commands.executeCommand('elonPet.tweet');
    }, seconds * 1000);

    // context.subscriptions.push(tweety);

    context.subscriptions.push(
        vscode.commands.registerCommand('elonPet.start', () => {
            if (
                getConfigurationPosition() === ExtPosition.explorer &&
                webviewViewProvider
            ) {
                vscode.commands.executeCommand('petsView.focus');
            } else {
                const spec = PetSpecification.fromConfiguration();
                PetPanel.createOrShow(
                    context.extensionUri,
                    spec.color,
                    spec.type,
                    spec.size,
                    getConfiguredTheme(),
                    getConfiguredThemeKind(),
                    getThrowWithMouseConfiguration(),
                );

                if (PetPanel.currentPanel) {
                    var collection = PetSpecification.collectionFromMemento(
                        context,
                        getConfiguredSize(),
                    );
                    collection.forEach((item) => {
                        PetPanel.currentPanel?.spawnPet(item);
                    });
                    // Store the collection in the memento, incase any of the null values (e.g. name) have been set
                    storeCollectionAsMemento(context, collection);
                }
            }
        }),
    );

    // status bar item
    petPlaygroundStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100,
    );
    petPlaygroundStatusBar.command = 'elonPet.start';
    context.subscriptions.push(petPlaygroundStatusBar);

    spawnPetStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100,
    );
    spawnPetStatusBar.command = 'elonPet.spawn-pet';
    context.subscriptions.push(spawnPetStatusBar);

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
    );
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(updateStatusBar),
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(
            updateExtensionPositionContext,
        ),
    );
    updateStatusBar();

    const spec = PetSpecification.fromConfiguration();
    webviewViewProvider = new PetWebviewViewProvider(
        context.extensionUri,
        spec.color,
        spec.type,
        spec.size,
        getConfiguredTheme(),
        getConfiguredThemeKind(),
        getThrowWithMouseConfiguration(),
    );
    updateExtensionPositionContext();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            PetWebviewViewProvider.viewType,
            webviewViewProvider,
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('elonPet.throw-ball', () => {
            const panel = getPetPanel();
            if (panel !== undefined) {
                panel.throwBall();
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('elonPet.delete-pet', async () => {
            const panel = getPetPanel();
            if (panel !== undefined) {
                panel.listPets();
                getWebview()?.onDidReceiveMessage(
                    handleRemovePetMessage,
                    context,
                );
            } else {
                createPetPlayground(context);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('elonPet.roll-call', async () => {
            const panel = getPetPanel();
            if (panel !== undefined) {
                panel.rollCall();
            } else {
                createPetPlayground(context);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'elonPet.export-pet-list',
            async () => {
                const pets = PetSpecification.collectionFromMemento(
                    context,
                    getConfiguredSize(),
                );
                const petJson = JSON.stringify(pets, null, 2);
                const fileName = `pets-${Date.now()}.json`;
                if (!vscode.workspace.workspaceFolders) {
                    vscode.window.showErrorMessage(
                        vscode.l10n.t(
                            'You must have a folder or workspace open to export pets.',
                        ),
                    );
                    return;
                }
                const filePath = vscode.Uri.joinPath(
                    vscode.workspace.workspaceFolders[0].uri,
                    fileName,
                );
                const newUri = vscode.Uri.file(fileName).with({
                    scheme: 'untitled',
                    path: filePath.fsPath,
                });
                vscode.workspace.openTextDocument(newUri).then((doc) => {
                    vscode.window.showTextDocument(doc).then((editor) => {
                        editor.edit((edit) => {
                            edit.insert(new vscode.Position(0, 0), petJson);
                        });
                    });
                });
            },
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'elonPet.import-pet-list',
            async () => {
                const options: vscode.OpenDialogOptions = {
                    canSelectMany: false,
                    openLabel: 'Open pets.json',
                    filters: {
                        json: ['json'],
                    },
                };
                const fileUri = await vscode.window.showOpenDialog(options);

                if (fileUri && fileUri[0]) {
                    console.log('Selected file: ' + fileUri[0].fsPath);
                    try {
                        const fileContents = await vscode.workspace.fs.readFile(
                            fileUri[0],
                        );
                        const petsToLoad = JSON.parse(
                            String.fromCharCode.apply(
                                null,
                                Array.from(fileContents),
                            ),
                        );

                        // load the pets into the collection
                        var collection = PetSpecification.collectionFromMemento(
                            context,
                            getConfiguredSize(),
                        );
                        // fetch just the pet types
                        const panel = getPetPanel();
                        for (let i = 0; i < petsToLoad.length; i++) {
                            const pet = petsToLoad[i];
                            const petSpec = new PetSpecification(
                                normalizeColor(pet.color),
                                pet.type,
                                pet.size,
                                pet.name,
                            );
                            collection.push(petSpec);
                            if (panel !== undefined) {
                                panel.spawnPet(petSpec);
                            }
                        }
                        storeCollectionAsMemento(context, collection);
                    } catch (e: any) {
                        vscode.window.showErrorMessage(
                            vscode.l10n.t(
                                'Failed to import pets: {0}',
                                e?.message,
                            ),
                        );
                    }
                }
            },
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('elonPet.spawn-pet', async () => {
            const panel = getPetPanel();
            if (panel) {
                const selectedPetType = PetType.elon;
                var elonColor: elonColor = DEFAULT_COLOR;
                const possibleColors = availableColors();

                if (possibleColors.length > 1) {
                    var selectedColor = await vscode.window.showQuickPick(
                        localize.stringListAsQuickPickItemList<elonColor>(
                            possibleColors,
                        ),
                        {
                            placeHolder: vscode.l10n.t('Select a color'),
                        },
                    );
                    if (selectedColor === undefined) {
                        return;
                    }
                    elonColor = selectedColor.value;
                } else {
                    elonColor = possibleColors[0];
                }

                if (elonColor === undefined) {
                    return;
                }

                const name = await vscode.window.showInputBox({
                    placeHolder: vscode.l10n.t('Leave blank for a random name'),
                    prompt: vscode.l10n.t('Give Elon a nickname'),
                    value: randomName(),
                });
                const spec = new PetSpecification(
                    elonColor,
                    selectedPetType,
                    getConfiguredSize(),
                    name,
                );
                if (!spec.type || !spec.color || !spec.size) {
                    return vscode.window.showWarningMessage(
                        vscode.l10n.t('Cancelled Spawning Pet'),
                    );
                } else if (spec) {
                    panel.spawnPet(spec);
                }
                var collection = PetSpecification.collectionFromMemento(
                    context,
                    getConfiguredSize(),
                );
                collection.push(spec);
                storeCollectionAsMemento(context, collection);
            } else {
                createPetPlayground(context);
                vscode.window.showInformationMessage(
                    vscode.l10n.t(
                        "A Pet Playground has been created. You can now use the 'Spawn Additional Pet' Command to add more pets.",
                    ),
                );
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('elonPet.remove-all-pets', () => {
            const panel = getPetPanel();
            if (panel !== undefined) {
                panel.resetPets();
                storeCollectionAsMemento(context, []);
            } else {
                createPetPlayground(context);
                vscode.window.showInformationMessage(
                    vscode.l10n.t(
                        "A Pet Playground has been created. You can now use the 'Remove all Elons' Command to Remove all Elons.",
                    ),
                );
            }
        }),
    );

    // Listening to configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(
            (e: vscode.ConfigurationChangeEvent): void => {
                if (
                    e.affectsConfiguration('elonPet.elonColor') ||
                    e.affectsConfiguration('elonPet.petType') ||
                    e.affectsConfiguration('elonPet.elonSize') ||
                    e.affectsConfiguration('elonPet.theme') ||
                    e.affectsConfiguration('workbench.colorTheme')
                ) {
                    const spec = PetSpecification.fromConfiguration();
                    const panel = getPetPanel();
                    if (panel) {
                        panel.updateelonColor(spec.color);
                        panel.updateelonSize(spec.size);
                        panel.updatePetType(spec.type);
                        panel.updateTheme(
                            getConfiguredTheme(),
                            getConfiguredThemeKind(),
                        );
                        panel.update();
                    }
                }

                if (e.affectsConfiguration('elonPet.position')) {
                    updateExtensionPositionContext();
                }

                if (e.affectsConfiguration('elonPet.throwBallWithMouse')) {
                    updatePanelThrowWithMouse();
                }
            },
        ),
    );

    if (vscode.window.registerWebviewPanelSerializer) {
        // Make sure we register a serializer in activation event
        vscode.window.registerWebviewPanelSerializer(PetPanel.viewType, {
            async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
                // Reset the webview options so we use latest uri for `localResourceRoots`.
                webviewPanel.webview.options = getWebviewOptions(
                    context.extensionUri,
                );
                const spec = PetSpecification.fromConfiguration();
                PetPanel.revive(
                    webviewPanel,
                    context.extensionUri,
                    spec.color,
                    spec.type,
                    spec.size,
                    getConfiguredTheme(),
                    getConfiguredThemeKind(),
                    getThrowWithMouseConfiguration(),
                );
            },
        });
    }
}

function updateStatusBar(): void {
    spawnPetStatusBar.text = `$(squirrel)`;
    spawnPetStatusBar.tooltip = vscode.l10n.t('Spawn Pet');
    spawnPetStatusBar.show();
}

export function petPlaygroundDeactivate() {
    petPlaygroundStatusBar.dispose();
}

export function spawnPetDeactivate() {
    spawnPetStatusBar.dispose();
}

function getWebviewOptions(
    extensionUri: vscode.Uri,
): vscode.WebviewOptions & vscode.WebviewPanelOptions {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    };
}

interface IPetPanel {
    throwBall(): void;
    resetPets(): void;
    spawnPet(spec: PetSpecification): void;
    deletePet(petName: string): void;
    listPets(): void;
    rollCall(): void;
    themeKind(): vscode.ColorThemeKind;
    throwBallWithMouse(): boolean;
    updateelonColor(newColor: elonColor): void;
    updatePetType(newType: PetType): void;
    updateelonSize(newSize: elonSize): void;
    updateTheme(newTheme: Theme, themeKind: vscode.ColorThemeKind): void;
    update(): void;
    setThrowWithMouse(newThrowWithMouse: boolean): void;
}

class PetWebviewContainer implements IPetPanel {
    protected _extensionUri: vscode.Uri;
    protected _disposables: vscode.Disposable[] = [];
    protected _elonColor: elonColor;
    protected _petType: PetType;
    protected _elonSize: elonSize;
    protected _theme: Theme;
    protected _themeKind: vscode.ColorThemeKind;
    protected _throwBallWithMouse: boolean;

    constructor(
        extensionUri: vscode.Uri,
        color: elonColor,
        type: PetType,
        size: elonSize,
        theme: Theme,
        themeKind: ColorThemeKind,
        throwBallWithMouse: boolean,
    ) {
        this._extensionUri = extensionUri;
        this._elonColor = color;
        this._petType = type;
        this._elonSize = size;
        this._theme = theme;
        this._themeKind = themeKind;
        this._throwBallWithMouse = throwBallWithMouse;
    }

    public elonColor(): elonColor {
        return normalizeColor(this._elonColor);
    }

    public petType(): PetType {
        return this._petType;
    }

    public elonSize(): elonSize {
        return this._elonSize;
    }

    public theme(): Theme {
        return this._theme;
    }

    public themeKind(): vscode.ColorThemeKind {
        return this._themeKind;
    }

    public throwBallWithMouse(): boolean {
        return this._throwBallWithMouse;
    }

    public updateelonColor(newColor: elonColor) {
        this._elonColor = newColor;
    }

    public updatePetType(newType: PetType) {
        this._petType = newType;
    }

    public updateelonSize(newSize: elonSize) {
        this._elonSize = newSize;
    }

    public updateTheme(newTheme: Theme, themeKind: vscode.ColorThemeKind) {
        this._theme = newTheme;
        this._themeKind = themeKind;
    }

    public setThrowWithMouse(newThrowWithMouse: boolean): void {
        this._throwBallWithMouse = newThrowWithMouse;
        this.getWebview().postMessage({
            command: 'throw-with-mouse',
            enabled: newThrowWithMouse,
        });
    }

    public throwBall() {
        this.getWebview().postMessage({
            command: 'throw-ball',
        });
    }

    public resetPets(): void {
        this.getWebview().postMessage({
            command: 'reset-pet',
        });
    }

    public spawnPet(spec: PetSpecification) {
        this.getWebview().postMessage({
            command: 'spawn-pet',
            type: spec.type,
            color: spec.color,
            name: spec.name,
        });
        this.getWebview().postMessage({ command: 'set-size', size: spec.size });
    }

    public listPets() {
        this.getWebview().postMessage({ command: 'list-pets' });
    }

    public rollCall(): void {
        this.getWebview().postMessage({ command: 'roll-call' });
    }

    public deletePet(petName: string) {
        this.getWebview().postMessage({ command: 'delete-pet', name: petName });
    }

    protected getWebview(): vscode.Webview {
        throw new Error('Not implemented');
    }

    protected _update() {
        const webview = this.getWebview();
        webview.html = this._getHtmlForWebview(webview);
    }

    public update() {}

    protected _getHtmlForWebview(webview: vscode.Webview) {
        const errorNum = getNumErrors();
        let i = "0";
        if (errorNum) {
            i = errorNum < 3 ? "1" : errorNum < 5 ? "2" : errorNum < 10 ? "3" : "4";
        } 

        const elonFace = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media/meter", `elon${i}.png`)
          );

        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(
            this._extensionUri,
            'media',
            'main-bundle.js',
        );

        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        // Local path to css styles
        const styleResetPath = vscode.Uri.joinPath(
            this._extensionUri,
            'media',
            'reset.css',
        );
        const stylesPathMainPath = vscode.Uri.joinPath(
            this._extensionUri,
            'media',
            'pets.css',
        );
        const facePath = vscode.Uri.joinPath(
            this._extensionUri,
            'media',
            'face.css',
        );

        const silkScreenFontPath = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                'media',
                'Silkscreen-Regular.ttf',
            ),
        );

        // Uri to load styles into webview
        const stylesResetUri = webview.asWebviewUri(styleResetPath);
        const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
        const faceUri = webview.asWebviewUri(facePath);

        // Get path to resource on disk
        const basePetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media'),
        );

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
                    webview.cspSource
                } 'nonce-${nonce}'; img-src ${
            webview.cspSource
        } https:; script-src 'nonce-${nonce}';
                font-src ${webview.cspSource};">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesResetUri}" rel="stylesheet" nonce="${nonce}">
				<link href="${stylesMainUri}" rel="stylesheet" nonce="${nonce}">
                <link href="${faceUri}" rel="stylesheet" nonce="${nonce}">
                <style nonce="${nonce}">
                @font-face {
                    font-family: 'silkscreen';
                    src: url('${silkScreenFontPath}') format('truetype');
                }
                </style>
				<title>ElonPet</title>
			</head>
			<body>
                <section>
                    <img src="${elonFace}">
                </section>
				<canvas id="petCanvas"></canvas>
				<div id="petsContainer"></div>
				<div id="foreground"></div>	
				<script nonce="${nonce}" src="${scriptUri}"></script>
				<script nonce="${nonce}">petApp.petPanelApp("${basePetUri}", "${this.theme()}", ${this.themeKind()}, "${this.elonColor()}", "${this.elonSize()}", "${this.petType()}", ${this.throwBallWithMouse()});</script>
			</body>
			</html>`;
    }
}

function handleWebviewMessage(message: WebviewMessage) {
    switch (message.command) {
        case 'alert':
            vscode.window.showErrorMessage(message.text);
            return;
        case 'info':
            vscode.window.showInformationMessage(message.text);
            return;
    }
}

/**
 * Manages ElonPet webview panels
 */
class PetPanel extends PetWebviewContainer implements IPetPanel {
    /**
     * Track the currently panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: PetPanel | undefined;

    public static readonly viewType = 'petCoding';

    private readonly _panel: vscode.WebviewPanel;

    public static createOrShow(
        extensionUri: vscode.Uri,
        elonColor: elonColor,
        petType: PetType,
        elonSize: elonSize,
        theme: Theme,
        themeKind: ColorThemeKind,
        throwBallWithMouse: boolean,
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it.
        if (PetPanel.currentPanel) {
            if (
                elonColor === PetPanel.currentPanel.elonColor() &&
                petType === PetPanel.currentPanel.petType() &&
                elonSize === PetPanel.currentPanel.elonSize()
            ) {
                PetPanel.currentPanel._panel.reveal(column);
                return;
            } else {
                PetPanel.currentPanel.updateelonColor(elonColor);
                PetPanel.currentPanel.updatePetType(petType);
                PetPanel.currentPanel.updateelonSize(elonSize);
                PetPanel.currentPanel.update();
            }
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            PetPanel.viewType,
            vscode.l10n.t('Pet Panel'),
            vscode.ViewColumn.Two,
            getWebviewOptions(extensionUri),
        );

        PetPanel.currentPanel = new PetPanel(
            panel,
            extensionUri,
            elonColor,
            petType,
            elonSize,
            theme,
            themeKind,
            throwBallWithMouse,
        );
    }

    public resetPets() {
        this.getWebview().postMessage({ command: 'reset-pet' });
    }

    public listPets() {
        this.getWebview().postMessage({ command: 'list-pets' });
    }

    public rollCall(): void {
        this.getWebview().postMessage({ command: 'roll-call' });
    }

    public deletePet(petName: string): void {
        this.getWebview().postMessage({ command: 'delete-pet', name: petName });
    }

    public static revive(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        elonColor: elonColor,
        petType: PetType,
        elonSize: elonSize,
        theme: Theme,
        themeKind: ColorThemeKind,
        throwBallWithMouse: boolean,
    ) {
        PetPanel.currentPanel = new PetPanel(
            panel,
            extensionUri,
            elonColor,
            petType,
            elonSize,
            theme,
            themeKind,
            throwBallWithMouse,
        );
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        color: elonColor,
        type: PetType,
        size: elonSize,
        theme: Theme,
        themeKind: ColorThemeKind,
        throwBallWithMouse: boolean,
    ) {
        super(
            extensionUri,
            color,
            type,
            size,
            theme,
            themeKind,
            throwBallWithMouse,
        );

        this._panel = panel;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            () => {
                this.update();
            },
            null,
            this._disposables,
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            handleWebviewMessage,
            null,
            this._disposables,
        );
    }

    public dispose() {
        PetPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    public update() {
        if (this._panel.visible) {
            this._update();
        }
    }

    getWebview(): vscode.Webview {
        return this._panel.webview;
    }
}

class PetWebviewViewProvider extends PetWebviewContainer {
    public static readonly viewType = 'petsView';

    private _webviewView?: vscode.WebviewView;

    resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
        this._webviewView = webviewView;

        webviewView.webview.options = getWebviewOptions(this._extensionUri);
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        setInterval(() => {
            // const errors = getNumErrors();
            // let i = "0";
            // if (errors) {
            //     i = errors < 5 ? "1" : errors < 10 ? "2" : "3";
            // }
            const temp = getNumErrors();
            if (numErrors !== temp) {
                numErrors = temp;
                webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
            }
          }, 1000);

        webviewView.webview.onDidReceiveMessage(
            handleWebviewMessage,
            null,
            this._disposables,
        );
    }

    update() {
        this._update();
    }

    getWebview(): vscode.Webview {
        if (this._webviewView === undefined) {
            throw new Error(
                vscode.l10n.t(
                    'Panel not active, make sure the pets view is visible before running this command.',
                ),
            );
        } else {
            return this._webviewView.webview;
        }
    }
}

function getNonce() {
    let text = '';
    const possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function createPetPlayground(context: vscode.ExtensionContext) {
    const spec = PetSpecification.fromConfiguration();
    PetPanel.createOrShow(
        context.extensionUri,
        spec.color,
        spec.type,
        spec.size,
        getConfiguredTheme(),
        getConfiguredThemeKind(),
        getThrowWithMouseConfiguration(),
    );
    if (PetPanel.currentPanel) {
        var collection = PetSpecification.collectionFromMemento(
            context,
            getConfiguredSize(),
        );
        collection.forEach((item) => {
            PetPanel.currentPanel?.spawnPet(item);
        });
        storeCollectionAsMemento(context, collection);
    } else {
        var collection = PetSpecification.collectionFromMemento(
            context,
            getConfiguredSize(),
        );
        collection.push(spec);
        storeCollectionAsMemento(context, collection);
    }
}

getNumErrors();

// function to get the number of errors in the open file
function getNumErrors(): number {
    const activeTextEditor: vscode.TextEditor | undefined =
      vscode.window.activeTextEditor;
    if (!activeTextEditor) {
      return 0;
    }
    const document: vscode.TextDocument = activeTextEditor.document;
  
    let numErrors = 0;
    //et numWarnings = 0;
  
    const aggregatedDiagnostics: any = {};
    let diagnostic: vscode.Diagnostic;
  
    // Iterate over each diagnostic that VS Code has reported for this file. For each one, add to
    // a list of objects, grouping together diagnostics which occur on a single line.
    for (diagnostic of vscode.languages.getDiagnostics(document.uri)) {
      const key = "line" + diagnostic.range.start.line;
  
      if (aggregatedDiagnostics[key]) {
        // Already added an object for this key, so augment the arrayDiagnostics[] array.
        aggregatedDiagnostics[key].arrayDiagnostics.push(diagnostic);
      } else {
        // Create a new object for this key, specifying the line: and a arrayDiagnostics[] array
        aggregatedDiagnostics[key] = {
          line: diagnostic.range.start.line,
          arrayDiagnostics: [diagnostic],
        };
      }
  
      switch (diagnostic.severity) {
        case 0:
          numErrors += 1;
          break;
  
        // case 1:
        //   numWarnings += 1;
        //   break;
  
        // Ignore other severities.
      }
    }
  
    return numErrors;
}

function handleErrorResponse() {
    setInterval(() => {
        const currErrCount = getNumErrors();
        if (currErrCount > errCount) {
            errCount = currErrCount;
            const randomIndex = Math.floor(Math.random() * angry_quotes.length);
            const randomQuote = angry_quotes[randomIndex];
            vscode.window.showWarningMessage(
                errCount.toString() + " errors! You made another error! "+ randomQuote
            );
        } else if (currErrCount < errCount) {
            errCount = currErrCount;
            const randomIndex = Math.floor(Math.random() * happy_quotes.length);
            const randomQuote = angry_quotes[randomIndex];
            vscode.window.showInformationMessage(
                errCount.toString() + " errors. You fixed an error! " + randomQuote
            );
        }
      }, 1000);
}