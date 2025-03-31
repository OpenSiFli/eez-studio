import path from "path";
import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    action,
    computed,
    makeObservable,
    observable,
    runInAction,
    values
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { ListContainer, List, IListNode, ListItem } from "eez-studio-ui/list";
import { Icon } from "eez-studio-ui/icon";

import { InstrumentsStore } from "home/instruments";

import { InstrumentObject, instruments } from "instrument/instrument-object";
import {
    historySessions,
    type IHistorySession
} from "instrument/window/history/session/store";
import { instrumentDatabases } from "eez-studio-shared/db";
import { shortcuts } from "shortcuts/shortcuts-store";
import { Shortcut } from "project-editor/features/shortcuts/project-shortcuts";
import i18n from "i18next";

////////////////////////////////////////////////////////////////////////////////

class ExportModel {
    instrumentsOption: "all" | "selected" = "all";
    selectedInstruments: Set<string> = new Set();

    sessionsOption: "all" | "selected" = "all";
    selectedSessions: Set<string> = new Set();

    shortcutsOption: "all" | "selected" = "all";
    selectedShortcuts: Set<string> = new Set();

    historyOption: "all" | "older-then" = "all";
    historyOdlerThenYears: number = 0;
    historyOdlerThenMonths: number = 0;
    historyOdlerThenDays: number = 0;

    removeHistoryAfterExport: boolean = false;

    constructor() {
        makeObservable(this, {
            instrumentsOption: observable,
            selectedInstruments: observable,

            sessionsOption: observable,
            selectedSessions: observable,

            shortcutsOption: observable,
            selectedShortcuts: observable,

            historyOption: observable,
            historyOdlerThenYears: observable,
            historyOdlerThenMonths: observable,
            historyOdlerThenDays: observable,

            removeHistoryAfterExport: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

const InstrumentNode = observer(
    class InstrumentNode extends React.Component<{
        exportModel: ExportModel;
        instrument: InstrumentObject;
    }> {
        render() {
            const { exportModel, instrument } = this.props;

            return (
                <ListItem
                    label={
                        <label
                            className="form-check-label d-flex align-items-center"
                            style={{ gap: 5 }}
                        >
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={exportModel.selectedInstruments.has(
                                    instrument.id
                                )}
                                onChange={action(event => {
                                    if (event.target.checked) {
                                        exportModel.selectedInstruments.add(
                                            instrument.id
                                        );
                                    } else {
                                        exportModel.selectedInstruments.delete(
                                            instrument.id
                                        );
                                    }
                                })}
                            />
                            <Icon icon={instrument.image} size={48} />
                            {instrument.name}
                        </label>
                    }
                />
            );
        }
    }
);

const InstrumentList = observer(
    class InstrumentList extends React.Component<{
        instrumentsStore: InstrumentsStore;
        exportModel: ExportModel;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                instruments: computed
            });
        }

        get instruments() {
            const instruments = this.props.instrumentsStore.instruments.slice();
            instruments.sort((a, b) => a.name.localeCompare(b.name));
            return this.props.instrumentsStore.instruments.map(instrument => ({
                id: instrument.id,
                data: instrument,
                selected: false
            }));
        }

        renderInstrumentNode = (node: IListNode) => {
            let instrument = node.data as InstrumentObject;
            return (
                <InstrumentNode
                    exportModel={this.props.exportModel}
                    instrument={instrument}
                />
            );
        };

        render() {
            return (
                <ListContainer tabIndex={0}>
                    <List
                        nodes={this.instruments}
                        renderNode={this.renderInstrumentNode}
                    />
                </ListContainer>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const SessionNode = observer(
    class SessionNode extends React.Component<{
        exportModel: ExportModel;
        session: IHistorySession;
    }> {
        render() {
            const { exportModel, session } = this.props;

            return (
                <ListItem
                    label={
                        <label
                            className="form-check-label form-check d-flex align-items-center"
                            style={{ gap: 5 }}
                        >
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id={`EezStudio_ExportDialog_Session_${session.id}`}
                                checked={exportModel.selectedSessions.has(
                                    session.id
                                )}
                                onChange={action(event => {
                                    if (event.target.checked) {
                                        exportModel.selectedSessions.add(
                                            session.id
                                        );
                                    } else {
                                        exportModel.selectedSessions.delete(
                                            session.id
                                        );
                                    }
                                })}
                            />
                            {session.name}
                        </label>
                    }
                />
            );
        }
    }
);

const SessionList = observer(
    class SessionList extends React.Component<{
        instrumentsStore: InstrumentsStore;
        exportModel: ExportModel;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                sessions: computed
            });
        }

        get sessions() {
            let sessions = historySessions.sessions.slice(1);

            sessions = sessions.sort((a, b) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            );

            return sessions.map(session => ({
                id: session.id,
                data: session,
                selected: false
            }));
        }

        renderSessionNode = (node: IListNode) => {
            let session = node.data as IHistorySession;
            return (
                <SessionNode
                    exportModel={this.props.exportModel}
                    session={session}
                />
            );
        };

        render() {
            return (
                <ListContainer tabIndex={0}>
                    <List
                        nodes={this.sessions}
                        renderNode={this.renderSessionNode}
                    />
                </ListContainer>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ShortcutNode = observer(
    class ShortcutNode extends React.Component<{
        exportModel: ExportModel;
        shortcut: Shortcut;
    }> {
        get groupName() {
            const shortcut = this.props.shortcut;
            if (shortcut.groupName.startsWith("__instrument__")) {
                const instrumentId = shortcut.groupName.slice(
                    "__instrument__".length
                );
                const instrument = instruments.get(instrumentId);
                if (instrument) {
                    return `instrument "${instrument.name}"`;
                }
            }
            return `group "${shortcut.groupName}"`;
        }

        render() {
            const { exportModel, shortcut } = this.props;

            return (
                <ListItem
                    label={
                        <label
                            className="form-check-label form-check d-flex align-items-center"
                            style={{ gap: 5 }}
                        >
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id={`EezStudio_ExportDialog_Session_${shortcut.id}`}
                                checked={exportModel.selectedShortcuts.has(
                                    shortcut.id
                                )}
                                onChange={action(event => {
                                    if (event.target.checked) {
                                        exportModel.selectedShortcuts.add(
                                            shortcut.id
                                        );
                                    } else {
                                        exportModel.selectedShortcuts.delete(
                                            shortcut.id
                                        );
                                    }
                                })}
                            />
                            <b>{shortcut.name}</b> / <i>{this.groupName}</i>
                        </label>
                    }
                />
            );
        }
    }
);

const ShortcutsList = observer(
    class ShortcutsList extends React.Component<{
        instrumentsStore: InstrumentsStore;
        exportModel: ExportModel;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                shortcuts: computed
            });
        }

        get shortcuts() {
            let exportShortcuts = values(shortcuts).filter(
                shortcut => !shortcut.groupName.startsWith("__extension__")
            );

            exportShortcuts = exportShortcuts.sort((a, b) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            );

            return exportShortcuts.map(shortcut => ({
                id: shortcut.id,
                data: shortcut,
                selected: false
            }));
        }

        renderShortcutNode = (node: IListNode) => {
            let shortcut = node.data as Shortcut;
            return (
                <ShortcutNode
                    exportModel={this.props.exportModel}
                    shortcut={shortcut}
                />
            );
        };

        render() {
            return (
                <ListContainer tabIndex={0}>
                    <List
                        nodes={this.shortcuts}
                        renderNode={this.renderShortcutNode}
                    />
                </ListContainer>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const HistoryExportSettings = observer(
    class HistoryExportSettings extends React.Component<{
        exportModel: ExportModel;
    }> {
        render() {
            const { exportModel } = this.props;

            return (
                <div>
                    <div className="EezStudio_ExportDialog_ArchiveOlderThen d-flex align-items-center">
                        <label className="form-label">
                            Years
                            <input
                                className="form-control"
                                type="number"
                                value={exportModel.historyOdlerThenYears}
                                min={0}
                                step={1}
                                onChange={action(event => {
                                    exportModel.historyOdlerThenYears =
                                        parseInt(event.target.value);
                                })}
                            />
                        </label>
                        <label className="form-label">
                            Months
                            <input
                                className="form-control"
                                type="number"
                                value={exportModel.historyOdlerThenMonths}
                                min={0}
                                step={1}
                                onChange={action(event => {
                                    exportModel.historyOdlerThenMonths =
                                        parseInt(event.target.value);
                                })}
                            />
                        </label>
                        <label className="form-label">
                            Days
                            <input
                                className="form-control"
                                type="number"
                                value={exportModel.historyOdlerThenDays}
                                min={0}
                                step={1}
                                onChange={action(event => {
                                    exportModel.historyOdlerThenDays = parseInt(
                                        event.target.value
                                    );
                                })}
                            />
                        </label>
                    </div>
                    <div className="EezStudio_ExportDialog_RemoveHistoryAfterExport">
                        <label
                            className="form-check-label d-flex align-items-center"
                            style={{ gap: 5 }}
                        >
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={exportModel.removeHistoryAfterExport}
                                onChange={action(event => {
                                    exportModel.removeHistoryAfterExport =
                                        event.target.checked;
                                })}
                            />
                            {i18n.t('dialog.deleteHistoryAfterExport.')}
                        </label>
                    </div>
                </div>
            );
        }
    }
);

const ExportDialog = observer(
    class ExportDialog extends React.Component<{
        instrumentsStore: InstrumentsStore;
    }> {
        mode: "instruments" | "sessions" | "shortcuts" | "archive" =
            "instruments";

        instrumentsExportModel = new ExportModel();
        sessionsExportModel = new ExportModel();
        shortcutsExportModel = new ExportModel();
        archiveExportModel = new ExportModel();

        description: string = "";

        error: string | undefined;

        constructor(props: any) {
            super(props);

            runInAction(() => {
                this.instrumentsExportModel.instrumentsOption = "selected";
                this.instrumentsExportModel.sessionsOption = "all";
                this.instrumentsExportModel.historyOption = "all";
                this.instrumentsExportModel.shortcutsOption = "all";
                this.instrumentsExportModel.removeHistoryAfterExport = false;

                this.sessionsExportModel.instrumentsOption = "selected";
                this.sessionsExportModel.sessionsOption = "selected";
                this.sessionsExportModel.shortcutsOption = "all";
                this.sessionsExportModel.historyOption = "all";
                this.sessionsExportModel.removeHistoryAfterExport = false;

                this.shortcutsExportModel.instrumentsOption = "all";
                this.shortcutsExportModel.sessionsOption = "all";
                this.shortcutsExportModel.shortcutsOption = "selected";
                this.shortcutsExportModel.historyOption = "all";
                this.shortcutsExportModel.removeHistoryAfterExport = false;

                this.archiveExportModel.instrumentsOption = "all";
                this.archiveExportModel.sessionsOption = "all";
                this.archiveExportModel.shortcutsOption = "all";
                this.archiveExportModel.historyOption = "older-then";
                this.archiveExportModel.historyOdlerThenYears = 1;
                this.archiveExportModel.removeHistoryAfterExport = false;
            });

            makeObservable(this, {
                mode: observable,
                description: observable,
                error: observable,
                exportModel: computed
            });
        }

        get exportModel() {
            if (this.mode == "instruments") return this.instrumentsExportModel;
            if (this.mode == "sessions") return this.sessionsExportModel;
            return this.archiveExportModel;
        }

        onInstrumentsOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                this.exportModel.instrumentsOption = e.target.value as any;
            }
        );

        onSessionsOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                this.exportModel.sessionsOption = e.target.value as any;
            }
        );

        onShortcutsOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                this.exportModel.shortcutsOption = e.target.value as any;
            }
        );

        onHistoryOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                this.exportModel.historyOption = e.target.value as any;
            }
        );

        onOK = action(() => {
            if (this.mode == "instruments") {
                if (this.exportModel.selectedInstruments.size == 0) {
                    this.error = i18n.t('validation.selectAtLeastOneInstrument');
                    return false;
                }
            }

            if (this.mode == "sessions") {
                if (this.exportModel.selectedSessions.size == 0) {
                    this.error = i18n.t('validation.selectAtLeastOneSession');
                    return false;
                }
            }

            if (this.mode == "shortcuts") {
                if (this.exportModel.selectedShortcuts.size == 0) {
                    this.error = i18n.t('validation.selectAtLeastOneShortcut');
                    return false;
                }
            }

            if (this.description.trim() == "") {
                this.error = i18n.t('validation.descriptionRequired');
                return false;
            }

            (async () => {
                let defaultPath = window.localStorage.getItem(
                    "lastExportDatabasePath"
                );

                const fileName = "export.db";

                const result = await dialog.showSaveDialog(getCurrentWindow(), {
                    filters: [
                        {
                            name: i18n.t('dialog.DBFiles'),
                            extensions: ["db"]
                        },
                        { name: i18n.t('dialog.AllFiles'), extensions: ["*"] }
                    ],
                    defaultPath: defaultPath
                        ? defaultPath + path.sep + fileName
                        : fileName
                });

                const filePath = result.filePath;

                if (filePath) {
                    window.localStorage.setItem(
                        "lastExportDatabasePath",
                        path.dirname(filePath)
                    );

                    instrumentDatabases.exportDatabase(filePath, {
                        mode: this.mode,
                        instrumentsOption: this.exportModel.instrumentsOption,
                        selectedInstruments: Array.from(
                            this.exportModel.selectedInstruments
                        ),
                        sessionsOption: this.exportModel.sessionsOption,
                        selectedSessions: Array.from(
                            this.exportModel.selectedSessions
                        ),
                        shortcutsOption: this.exportModel.shortcutsOption,
                        selectedShortcuts: Array.from(
                            this.exportModel.selectedShortcuts
                        ),
                        historyOption: this.exportModel.historyOption,
                        historyOdlerThenYears:
                            this.exportModel.historyOdlerThenYears,
                        historyOdlerThenMonths:
                            this.exportModel.historyOdlerThenMonths,
                        historyOdlerThenDays:
                            this.exportModel.historyOdlerThenDays,
                        removeHistoryAfterExport:
                            this.exportModel.removeHistoryAfterExport,
                        description: this.description
                    });
                }
            })();

            return true;
        });

        render() {
            return (
                <Dialog
                    className="EezStudio_ExportDialog"
                    title="Export"
                    onOk={this.onOK}
                    additionalFooterControl={
                        this.error ? (
                            <div className="text-danger">{this.error}</div>
                        ) : undefined
                    }
                    size="large"
                >
                    <ul className="nav nav-pills">
                        <li className="nav-item">
                            <a
                                className={classNames("nav-link", {
                                    active: this.mode == "instruments"
                                })}
                                href="#"
                                onClick={action(event => {
                                    event.preventDefault();
                                    this.mode = "instruments";
                                })}
                            >
                                {i18n.t('dialog.ExportInstrumentsDialog.ExportInstrumentsOption')}
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className={classNames("nav-link", {
                                    active: this.mode == "sessions"
                                })}
                                href="#"
                                onClick={action(event => {
                                    event.preventDefault();
                                    this.mode = "sessions";
                                })}
                            >
                                {i18n.t('dialog.ExportInstrumentsDialog.ExportSessionsOption')}
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className={classNames("nav-link", {
                                    active: this.mode == "shortcuts"
                                })}
                                href="#"
                                onClick={action(event => {
                                    event.preventDefault();
                                    this.mode = "shortcuts";
                                })}
                            >
                                {i18n.t('dialog.ExportInstrumentsDialog.ExportShortcutsOption')}
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className={classNames("nav-link", {
                                    active: this.mode == "archive"
                                })}
                                href="#"
                                onClick={action(event => {
                                    event.preventDefault();
                                    this.mode = "archive";
                                })}
                            >
                                {i18n.t('dialog.ExportInstrumentsDialog.ArchiveHistoryOption')}
                            </a>
                        </li>
                    </ul>

                    {this.mode == "instruments" && (
                        <InstrumentList
                            instrumentsStore={this.props.instrumentsStore}
                            exportModel={this.exportModel}
                        />
                    )}

                    {this.mode == "sessions" && (
                        <SessionList
                            instrumentsStore={this.props.instrumentsStore}
                            exportModel={this.exportModel}
                        />
                    )}

                    {this.mode == "shortcuts" && (
                        <ShortcutsList
                            instrumentsStore={this.props.instrumentsStore}
                            exportModel={this.exportModel}
                        />
                    )}

                    {this.mode == "archive" && (
                        <div className="EezStudio_ExportDialog_ArchiveMode">
                            <div style={{ marginBottom: 10 }}>
                                {i18n.t('dialog.ExportInstrumentsDialog.ArchiveModeTitle')}
                            </div>
                            <HistoryExportSettings
                                exportModel={this.exportModel}
                            />
                        </div>
                    )}

                    <div style={{ marginTop: 20 }}>
                        <label
                            htmlFor="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                            className="form-label"
                        >
                            {i18n.t('dialog.ExportInstrumentsDialog.ItemDetailsDescriptionTitle')}
                        </label>
                        <textarea
                            className="form-control"
                            id="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                            rows={3}
                            value={this.description}
                            onChange={action(event => {
                                this.description = event.target.value;
                            })}
                        ></textarea>
                    </div>
                </Dialog>
            );
        }
    }
);

export function showExportDialog(instrumentsStore: InstrumentsStore) {
    showDialog(<ExportDialog instrumentsStore={instrumentsStore} />);
}
