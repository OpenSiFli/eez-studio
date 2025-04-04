import fs from "fs";
import { ipcRenderer, shell, clipboard } from "electron";
import { dialog, getCurrentWindow } from "@electron/remote";
import { confirm } from "eez-studio-ui/dialog-electron";
import path from "path";
import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    toJS,
    makeObservable,
    reaction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import * as FlexLayout from "flexlayout-react";
import i18n from "i18next";
import { useTranslation } from "react-i18next";
import { app, createEmptyFile } from "eez-studio-shared/util-electron";
import { stringCompare } from "eez-studio-shared/string";
import {
    initInstrumentDatabase,
    InstrumentDatabase,
    instrumentDatabases
} from "eez-studio-shared/db";
import {
    LOCALES,
    getLocale,
    setLocale,
    DATE_FORMATS,
    getDateFormat,
    setDateFormat,
    TIME_FORMATS,
    getTimeFormat,
    setTimeFormat
} from "eez-studio-shared/i10n";

import { LANGUAGES, changeLanguage, TranslationComponentProps } from "eez-studio-shared/i18n/i18n";
import { withTranslation } from 'react-i18next';

import { formatBytes } from "eez-studio-shared/formatBytes";

import { showDialog, Dialog } from "eez-studio-ui/dialog";
import { Loader } from "eez-studio-ui/loader";
import {
    AbsoluteFileInputProperty,
    BooleanProperty,
    PropertyList,
    SelectProperty,
    StaticProperty
} from "eez-studio-ui/properties";
import * as notification from "eez-studio-ui/notification";
import {
    Body,
    Header,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";

import dbVacuum from "db-services/vacuum";
import { getMoment } from "eez-studio-shared/util";
import type { IMruItem } from "main/settings";
import { IconAction } from "eez-studio-ui/action";
import { HOME_TAB_OPEN_ICON } from "project-editor/ui-components/icons";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { homeLayoutModels } from "./home-layout-models";

////////////////////////////////////////////////////////////////////////////////

export const COMPACT_DATABASE_MESSAGE = i18n.t('settings.DatabaseMaintenanceRecommendation');

////////////////////////////////////////////////////////////////////////////////

const getIsDarkTheme = function () {
    return ipcRenderer.sendSync("getIsDarkTheme");
};

const setIsDarkTheme = function (value: boolean) {
    ipcRenderer.send("setIsDarkTheme", value);
};

////////////////////////////////////////////////////////////////////////////////

const getMRU: () => IMruItem[] = function () {
    return ipcRenderer.sendSync("getMRU");
};

const setMRU = function (value: IMruItem[]) {
    ipcRenderer.send("setMRU", toJS(value));
};

ipcRenderer.on("mru-changed", async (sender: any, mru: IMruItem[]) => {
    function isMruChanged(mru1: IMruItem[], mru2: IMruItem[]) {
        if (!!mru1 != !!mru) {
            return true;
        }

        if (mru1.length != mru2.length) {
            return true;
        }
        for (let i = 0; i < mru1.length; i++) {
            if (
                mru1[i].filePath != mru2[i].filePath ||
                mru1[i].projectType != mru2[i].projectType
            ) {
                return true;
            }
        }
        return false;
    }

    if (isMruChanged(mru, settingsController.mru)) {
        runInAction(() => (settingsController.mru = mru));
    }
});

////////////////////////////////////////////////////////////////////////////////

const getShowComponentsPaletteInProjectEditor = function () {
    return ipcRenderer.sendSync("getShowComponentsPaletteInProjectEditor");
};

const setShowComponentsPaletteInProjectEditor = function (value: boolean) {
    ipcRenderer.send("setShowComponentsPaletteInProjectEditor", value);
};

////////////////////////////////////////////////////////////////////////////////

class SettingsController {
    activetLocale = getLocale();
    activeDateFormat = getDateFormat();
    activeTimeFormat = getTimeFormat();

    selectedDatabase: InstrumentDatabase | undefined;

    locale: string = getLocale();
    language: string = getLocale();
    dateFormat: string = getDateFormat();
    timeFormat: string = getTimeFormat();
    isDarkTheme: boolean = getIsDarkTheme();
    mru: IMruItem[] = getMRU();

    pythonUseCustomPath: boolean = false;
    pythonCustomPath: string = "";

    _showComponentsPaletteInProjectEditor: boolean =
        getShowComponentsPaletteInProjectEditor();

    constructor() {
        this.pythonUseCustomPath =
            window.localStorage.getItem("pythonUseCustomPath") == "1"
                ? true
                : false;
        this.pythonCustomPath =
            window.localStorage.getItem("pythonCustomPath") ?? "";

        this.selectedDatabase = instrumentDatabases.activeDatabase;

        makeObservable(this, {
            selectedDatabase: observable,
            locale: observable,
            language: observable,
            dateFormat: observable,
            timeFormat: observable,
            isDarkTheme: observable,
            mru: observable,
            restartRequired: computed,
            onLocaleChange: action.bound,
            onLanguageChange: action.bound,
            onDateFormatChanged: action.bound,
            onTimeFormatChanged: action.bound,
            switchTheme: action.bound,
            removeItemFromMRU: action,
            pythonUseCustomPath: observable,
            pythonCustomPath: observable
        });

        this.onThemeSwitched();

        reaction(
            () => ({
                setCustomPath: this.pythonUseCustomPath,
                customPythonPath: this.pythonCustomPath
            }),
            ({ setCustomPath, customPythonPath }) => {
                window.localStorage.setItem(
                    "pythonUseCustomPath",
                    setCustomPath ? "1" : "0"
                );
                window.localStorage.setItem(
                    "pythonCustomPath",
                    customPythonPath
                );
            }
        );
    }

    get restartRequired() {
        return (
            instrumentDatabases.activeDatabase?.filePath !==
            instrumentDatabases.activeDatabasePath ||
            this.locale !== this.activetLocale ||
            this.dateFormat !== this.activeDateFormat ||
            this.timeFormat !== this.activeTimeFormat
        );
    }

    onLocaleChange(value: string) {
        this.locale = value;
        setLocale(value);
    }

    onLanguageChange(value: string) {
        this.language = value;
        changeLanguage(value);
    }

    onDateFormatChanged(value: string) {
        this.dateFormat = value;
        setDateFormat(value);
    }

    onTimeFormatChanged(value: string) {
        this.timeFormat = value;
        setTimeFormat(value);
    }

    onThemeSwitchedTimeout: any;

    switchTheme(value: boolean) {
        if (this.onThemeSwitchedTimeout) {
            return;
        }

        this.isDarkTheme = value;
        setIsDarkTheme(value);
        this.onThemeSwitched();
    }

    onThemeSwitched() {
        const content = document.getElementById(
            "EezStudio_Content"
        ) as HTMLDivElement;
        content.style.opacity = "0";

        const mainLinkElement = document.getElementById(
            "main-css"
        ) as HTMLLinkElement;

        const flexlayoutLinkElement = document.getElementById(
            "flexlayout-css"
        ) as HTMLLinkElement;

        if (this.isDarkTheme) {
            document.body.parentElement?.setAttribute("data-bs-theme", "dark");

            mainLinkElement.href =
                "../eez-studio-ui/_stylesheets/main-dark.css";

            flexlayoutLinkElement.href =
                "../../node_modules/flexlayout-react/style/dark.css";
        } else {
            document.body.parentElement?.setAttribute("data-bs-theme", "light");

            mainLinkElement.href = "../eez-studio-ui/_stylesheets/main.css";

            flexlayoutLinkElement.href =
                "../../node_modules/flexlayout-react/style/light.css";
        }

        this.onThemeSwitchedTimeout = setTimeout(() => {
            this.onThemeSwitchedTimeout = undefined;
            content.style.opacity = "";
        }, 500);
    }

    removeItemFromMRU(mruItem: IMruItem) {
        const i = this.mru.indexOf(mruItem);
        if (i != -1) {
            this.mru.splice(i, 1);
            setMRU(this.mru);
        }
    }

    addDatabase(filePath: string, isActive: boolean) {
        instrumentDatabases.addDatabase(filePath, isActive);

        runInAction(() => {
            this.selectedDatabase = instrumentDatabases.databases.find(
                database => database.filePath == filePath
            );
        });
    }

    createNewDatabase = async () => {
        let defaultPath = window.localStorage.getItem("lastDatabaseSavePath");

        const result = await dialog.showSaveDialog(getCurrentWindow(), {
            filters: [
                { name: i18n.t('dialog.DBFiles'), extensions: ["db"] },
                { name: i18n.t('dialog.AllFiles'), extensions: ["*"] }
            ],
            defaultPath: defaultPath ?? undefined
        });

        const filePath = result.filePath;

        if (filePath) {
            try {
                createEmptyFile(filePath);

                await initInstrumentDatabase(filePath);

                const onFinish = action((isActive: boolean) => {
                    this.addDatabase(filePath, isActive);

                    window.localStorage.setItem(
                        "lastDatabaseSavePath",
                        path.dirname(filePath)
                    );

                    if (isActive) {
                        this.askForRestart();
                    }
                });

                confirm(
                    i18n.t('dialog.DatabaseActiveConfirmMessage'),
                    undefined,
                    () => onFinish(true),
                    () => onFinish(false)
                );
            } catch (error) {
                notification.error(error.toString());
            }
        }
    };

    openDatabase = async () => {
        let defaultPath = window.localStorage.getItem("lastDatabaseOpenPath");

        const result = await dialog.showOpenDialog(getCurrentWindow(), {
            properties: ["openFile"],
            filters: [
                { name: i18n.t('dialog.DBFiles'), extensions: ["db"] },
                { name: i18n.t('dialog.AllFiles'), extensions: ["*"] }
            ],
            defaultPath: defaultPath ?? undefined
        });

        const filePaths = result.filePaths;

        if (filePaths && filePaths[0]) {
            const filePath = filePaths[0];

            const onFinish = action((isActive: boolean) => {
                this.addDatabase(filePath, isActive);

                window.localStorage.setItem(
                    "lastDatabaseOpenPath",
                    path.dirname(filePath)
                );

                if (isActive) {
                    this.askForRestart();
                }
            });

            confirm(
                i18n.t('dialog.DatabaseActiveConfirmMessage'),
                undefined,
                () => onFinish(true),
                () => onFinish(false)
            );
        }
    };

    askForRestart = () => {
        if (
            instrumentDatabases.activeDatabase &&
            instrumentDatabases.activeDatabase.filePath !=
            instrumentDatabases.activeDatabasePath
        ) {
            confirm(
                i18n.t('dialog.AskForRestartMessage'),
                i18n.t('dialog.AskForRestartDetail'),
                this.restart
            );
        }
    };

    restart = () => {
        app.relaunch();
        app.exit();
    };

    setAsActiveDatabase = action(() => {
        if (this.selectedDatabase) {
            instrumentDatabases.setAsActiveDatabase(this.selectedDatabase);

            this.askForRestart();
        }
    });

    deleteDatabase = () => {
        if (this.selectedDatabase) {
            instrumentDatabases.removeDatabase(this.selectedDatabase);
        }
    };

    showDatabasePathInFolder = () => {
        if (this.selectedDatabase) {
            shell.showItemInFolder(this.selectedDatabase.filePath);
        }
    };

    compactDatabase = () => {
        if (!this.selectedDatabase) {
            return;
        }
        showDialog(<CompactDatabaseDialog database={this.selectedDatabase} />);
    };

    get showComponentsPaletteInProjectEditor() {
        return this._showComponentsPaletteInProjectEditor;
    }

    set showComponentsPaletteInProjectEditor(value: boolean) {
        this._showComponentsPaletteInProjectEditor = value;
        setShowComponentsPaletteInProjectEditor(value);
    }
}

export const settingsController = new SettingsController();

////////////////////////////////////////////////////////////////////////////////

const CompactDatabaseDialog = observer(
    class CompactDatabaseDialog extends React.Component<{
        database: InstrumentDatabase;
    }> {
        sizeBefore: number;
        sizeAfter: number | undefined;
        sizeReduced: number | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                sizeBefore: observable,
                sizeAfter: observable,
                sizeReduced: observable
            });

            this.sizeBefore = fs.statSync(this.props.database.filePath).size;
        }

        async componentDidMount() {
            try {
                await dbVacuum();

                runInAction(() => {
                    this.props.database.timeOfLastDatabaseCompactOperation =
                        Date.now();
                });

                runInAction(() => {
                    var fs = require("fs");

                    this.sizeAfter = fs.statSync(
                        this.props.database.filePath
                    ).size;

                    this.props.database.databaseSize = this.sizeAfter!;

                    this.sizeReduced =
                        (100 * (this.sizeBefore - this.sizeAfter!)) /
                        this.sizeBefore;
                    if (this.sizeReduced < 1) {
                        this.sizeReduced =
                            Math.round(100 * this.sizeReduced) / 100;
                    } else if (this.sizeReduced < 10) {
                        this.sizeReduced =
                            Math.round(10 * this.sizeReduced) / 10;
                    } else {
                        this.sizeReduced = Math.round(this.sizeReduced);
                    }
                });
            } catch (err) {
                notification.error(err);
            }
        }

        render() {
            return (
                <Dialog
                    open={true}
                    title="Compacting Database"
                    size="small"
                    cancelButtonText="Close"
                    cancelDisabled={this.sizeAfter === undefined}
                >
                    <table className="EezStudio_CompactDatabaseDialogTable">
                        <tbody>
                            <tr>
                                <td>Size before</td>
                                <td>{formatBytes(this.sizeBefore)}</td>
                            </tr>
                            <tr>
                                <td>Size after</td>
                                <td>
                                    {this.sizeAfter !== undefined ? (
                                        formatBytes(this.sizeAfter)
                                    ) : (
                                        <Loader style={{ margin: 0 }} />
                                    )}
                                </td>
                            </tr>
                            {this.sizeReduced !== undefined && (
                                <tr>
                                    <td>Size reduced by </td>
                                    <td>
                                        {formatBytes(
                                            this.sizeBefore - this.sizeAfter!
                                        )}{" "}
                                        or {this.sizeReduced}%
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </Dialog>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const DatabaseListItem = observer(
    class DbPathListItem extends React.Component<{
        database: InstrumentDatabase;
        isSelected: boolean;
        onSelect: () => void;
    }> {
        render() {
            const { database, isSelected, onSelect } = this.props;

            const className = classNames({
                selected: isSelected
            });

            return (
                <tr className={className} onClick={onSelect}>
                    <td
                        style={{
                            fontWeight: database.isActive ? "bold" : "normal"
                        }}
                    >
                        {database.isActive ? "[ACTIVE] " : ""}
                        {path.parse(database.filePath).name}
                    </td>
                </tr>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const SelectedDatabaseDetails = withTranslation()(observer(
    class SelectedDatabaseDetails extends React.Component<TranslationComponentProps> {
        render() {
            const { t } = this.props;
            const selectedDatabase = settingsController.selectedDatabase;
            if (!selectedDatabase) {
                return null;
            }

            return (
                <div className="EezStudio_Settings_Database_Details">
                    {!selectedDatabase.isActive && (
                        <div>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={settingsController.setAsActiveDatabase}
                            >
                                {t("settings.SelectedDatabaseDetails.SetAsActive")}
                            </button>
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                            className="form-label"
                        >
                            {t("settings.SelectedDatabaseDetails.Description")}
                        </label>
                        <textarea
                            className="form-control"
                            id="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                            rows={3}
                            value={selectedDatabase.description}
                            onChange={action(event => {
                                selectedDatabase.description =
                                    event.target.value;
                            })}
                            onBlur={() => selectedDatabase.storeDescription()}
                        ></textarea>
                    </div>

                    <div>
                        <label className="form-label">Path:</label>
                        <div>{selectedDatabase.filePath}</div>

                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={
                                settingsController.showDatabasePathInFolder
                            }
                            style={{ marginTop: "5px" }}
                        >
                            {t("settings.SelectedDatabaseDetails.ShowInFolder")}
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                                clipboard.writeText(selectedDatabase.filePath)
                            }
                            style={{ marginTop: "5px", marginLeft: "5px" }}
                        >
                            {t("settings.SelectedDatabaseDetails.CopyPathToClipboard")}
                        </button>
                    </div>

                    <div
                        className={classNames("EezStudio_DatabaseCompactDiv", {
                            databaseCompactIsAdvisable:
                                selectedDatabase.isCompactDatabaseAdvisable
                        })}
                    >
                        <div>
                            {t('settings.SelectedDatabaseDetails.DatabaseSize', { size: formatBytes(selectedDatabase.databaseSize) })}
                        </div>
                        <div>
                            {t('settings.SelectedDatabaseDetails.DatabaseLastCompact', { date: getMoment()(selectedDatabase.timeOfLastDatabaseCompactOperation).fromNow() })}
                        </div>
                        {selectedDatabase.isCompactDatabaseAdvisable && (
                            <div>{COMPACT_DATABASE_MESSAGE}</div>
                        )}
                        <div className="btn-group me-2">
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={settingsController.compactDatabase}
                            >
                                {t("settings.SelectedDatabaseDetails.CompactDatabase")}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    }
));

////////////////////////////////////////////////////////////////////////////////

const DatatabaseList = withTranslation()(observer(
    class DatatabaseList extends React.Component<TranslationComponentProps> {
        ref = React.createRef<HTMLDivElement>();

        componentDidMount() {
            this.ensureSelectedVisible();
        }

        componentDidUpdate() {
            this.ensureSelectedVisible();
        }

        ensureSelectedVisible() {
            const selected = this.ref.current?.querySelector(".selected");
            if (selected) {
                selected.scrollIntoView({ block: "nearest" });
            }
        }

        render() {
            return (
                <VerticalHeaderWithBody className="EezStudio_Settings_Databases_List">
                    <ToolbarHeader>
                        <IconAction
                            icon="material:add"
                            title={this.props.t("settings.CreateNewDatabase")}
                            onClick={settingsController.createNewDatabase}
                        />
                        <IconAction
                            icon={HOME_TAB_OPEN_ICON}
                            title={this.props.t("settings.OpenExistingDatabase")}
                            onClick={settingsController.openDatabase}
                        />
                        <IconAction
                            icon="material:delete"
                            title={this.props.t("settings.DeleteDatabase")}
                            onClick={settingsController.deleteDatabase}
                            enabled={
                                settingsController.selectedDatabase &&
                                !settingsController.selectedDatabase.isActive
                            }
                        />
                    </ToolbarHeader>
                    <Body>
                        <div
                            className="EezStudio_Settings_Databases_List_Body"
                            ref={this.ref}
                        >
                            <table>
                                <tbody>
                                    {instrumentDatabases.databases.map(
                                        database => (
                                            <DatabaseListItem
                                                key={database.filePath}
                                                database={database}
                                                isSelected={
                                                    database.filePath ==
                                                    settingsController
                                                        .selectedDatabase
                                                        ?.filePath
                                                }
                                                onSelect={action(
                                                    action(() => {
                                                        settingsController.selectedDatabase =
                                                            database;
                                                    })
                                                )}
                                            />
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
));

////////////////////////////////////////////////////////////////////////////////

const Databases = withTranslation()(observer(
    class Databases extends React.Component<TranslationComponentProps> {
        factory(node: FlexLayout.TabNode) {
            var component = node.getComponent();

            if (component === "list") {
                return <DatatabaseList />;
            }

            if (component === "details") {
                return <SelectedDatabaseDetails />;
            }

            return null;
        }

        render() {
            const { t } = this.props;
            return (
                <tr>
                    <td>{t("settings.Databases")}</td>

                    <td>
                        <div className="EezStudio_Settings_Databases">
                            <FlexLayoutContainer
                                model={homeLayoutModels.databaseSettings}
                                factory={this.factory}
                            />
                        </div>
                    </td>
                </tr>
            );
        }
    }
));

////////////////////////////////////////////////////////////////////////////////

const PythonSettings = withTranslation()(observer(
    class PythonSettings extends React.Component<TranslationComponentProps> {
        constructor(props: any) {
            super(props);

            const { PythonShell } =
                require("python-shell") as typeof import("python-shell");

            PythonShell.runString(
                "import sys;print(sys.executable)",
                undefined,
                action((err, output) => {
                    if (err) {
                        console.log(err);
                        this.pythonPathError = true;
                    } else if (!output) {
                        this.pythonPathError = true;
                    } else {
                        this.pythonPath = output[0];
                    }
                })
            );

            makeObservable(this, {
                pythonPath: observable,
                pythonPathError: observable
            });
        }

        pythonPath: string = "";
        pythonPathError: boolean = false;

        render() {
            const { t } = this.props;
            return (
                <tr>
                    <td>Python</td>
                    <td>
                        <PropertyList>
                            <StaticProperty
                                name={t("settings.python.DefaultPath")}
                                value={
                                    this.pythonPathError
                                        ? t("settings.python.NotFound")
                                        : this.pythonPath
                                }
                                className="StaticPropertyValueWrap"
                            />
                            <BooleanProperty
                                name={`${t("settings.python.SetCustomPath")}`}
                                value={settingsController.pythonUseCustomPath}
                                onChange={action(
                                    value =>
                                    (settingsController.pythonUseCustomPath =
                                        value)
                                )}
                                checkboxStyleSwitch={true}
                            />
                            {settingsController.pythonUseCustomPath && (
                                <AbsoluteFileInputProperty
                                    name={t("settings.python.CustomPath")}
                                    value={settingsController.pythonCustomPath}
                                    onChange={action(value => {
                                        settingsController.pythonCustomPath =
                                            value;
                                    })}
                                />
                            )}
                        </PropertyList>
                    </td>
                </tr>
            );
        }
    }
));

////////////////////////////////////////////////////////////////////////////////

export const Settings = observer(() => {
    const { t } = useTranslation();
    return (
        <div className="EezStudio_HomeSettingsBody">
            <PropertyList>
                <Databases />
                <SelectProperty
                    name={t("settings.Locale")}
                    value={settingsController.locale}
                    onChange={settingsController.onLocaleChange}
                >
                    {Object.entries(LOCALES)
                        .slice()
                        .sort((a, b) => stringCompare(a[1], b[1]))
                        .map(([code, name]) => (
                            <option key={code} value={code}>
                                {name}
                            </option>
                        ))}
                </SelectProperty>
                <SelectProperty
                    name={t("settings.Language")}
                    value={settingsController.language}
                    onChange={settingsController.onLanguageChange}
                >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                        <option key={code} value={code}>
                            {name}
                        </option>
                    ))}
                </SelectProperty>
                <SelectProperty
                    name={t("settings.DateFormat")}
                    value={settingsController.dateFormat}
                    onChange={settingsController.onDateFormatChanged}
                >
                    {DATE_FORMATS.map(format => (
                        <option
                            key={format.format}
                            value={format.format}
                        >
                            {getMoment()(new Date())
                                .locale(settingsController.locale)
                                .format(format.format)}
                        </option>
                    ))}
                </SelectProperty>
                <SelectProperty
                    name={t("settings.TimeFormat")}
                    value={settingsController.timeFormat}
                    onChange={settingsController.onTimeFormatChanged}
                >
                    {TIME_FORMATS.map(format => (
                        <option
                            key={format.format}
                            value={format.format}
                        >
                            {getMoment()(new Date())
                                .locale(settingsController.locale)
                                .format(format.format)}
                        </option>
                    ))}
                </SelectProperty>
                <PythonSettings />
                <BooleanProperty
                    name={t('settings.DarkTheme')}
                    value={settingsController.isDarkTheme}
                    onChange={settingsController.switchTheme}
                    checkboxStyleSwitch={true}
                />
            </PropertyList>
            {settingsController.restartRequired && (
                <Header className="EezStudio_HomeSettingsBar EezStudio_PanelHeader">
                    <div className="btn-group me-2">
                        <button
                            className="btn btn-primary EezStudio_PulseTransition"
                            onClick={settingsController.restart}
                        >
                            {t('button.Restart')}
                        </button>
                    </div>
                </Header>
            )}
        </div>
    );
});

////////////////////////////////////////////////////////////////////////////////
