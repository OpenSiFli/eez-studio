import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";
import {
    PropertyList,
    StaticProperty,
    TextInputProperty,
    BooleanProperty
} from "eez-studio-ui/properties";
import { AlertDanger } from "eez-studio-ui/alert";
import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";
import * as notification from "eez-studio-ui/notification";

import { ConnectionProperties } from "instrument/window/connection-dialog";
import { InstrumentObject } from "instrument/instrument-object";

import { ConnectionParameters } from "instrument/connection/interface";

import type * as CatalogModule from "home/extensions-manager/catalog";
import type * as ExtensionManagerModule from "home/extensions-manager/extensions-manager";
import type { InstrumentsStore } from "home/instruments";

import { withTranslation } from 'react-i18next';
import { TranslationComponentProps } from "eez-studio-shared/i18n/i18n";
import { TFunction } from 'i18next';

////////////////////////////////////////////////////////////////////////////////

export const InstrumentToolbar = withTranslation()(observer(
    class InstrumentToolbar extends React.Component<
        TranslationComponentProps &
        {
            instrument: InstrumentObject;
            instrumentsStore: InstrumentsStore;
        }> {
        onOpenInTab = () => {
            this.props.instrument.openEditor("tab");
        };

        onOpenInWindow = () => {
            this.props.instrument.openEditor("window");
        };

        onDelete = () => {
            window.postMessage(
                {
                    type: "delete-instrument",
                    instrumentId: this.props.instrument.id
                },
                "*"
            );
        };

        render() {
            const { t } = this.props;
            return (
                <Toolbar>
                    {this.props.instrument.isUnknownExtension && (
                        <ButtonAction
                            text={t("instrument.InstallExtension")}
                            title={t("instrument.InstallExtensionTitle")}
                            className="btn btn-default btn-primary"
                            onClick={() =>
                                installExtension(t, this.props.instrument)
                            }
                        />
                    )}
                    {!this.props.instrumentsStore.selectInstrument && (
                        <ButtonAction
                            text={t("instrument.OpenInTab")}
                            title={t("instrument.OpenInTabTitle")}
                            className="btn btn-secondary"
                            onClick={this.onOpenInTab}
                        />
                    )}
                    {!this.props.instrumentsStore.selectInstrument && (
                        <ButtonAction
                            text={t("instrument.OpenInNewWindow")}
                            title={t("instrument.OpenInNewWindowTitle")}
                            className="btn btn-secondary"
                            onClick={this.onOpenInWindow}
                        />
                    )}
                    <ButtonAction
                        text={t("instrument.Delete")}
                        title={t("instrument.DeleteTitle")}
                        className="btn btn-danger"
                        onClick={this.onDelete}
                    />
                </Toolbar>
            );
        }
    }
));

////////////////////////////////////////////////////////////////////////////////

export const InstrumentProperties = observer(
    class InstrumentProperties extends React.Component<{
        instrument: InstrumentObject;
    }> {
        render() {
            return <Properties instrument={this.props.instrument} />;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const InstrumentConnection = observer(
    class InstrumentConnection extends React.Component<{
        instrument: InstrumentObject;
    }> {
        render() {
            return <Connection instrument={this.props.instrument} />;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ConnectionParametersDetails = withTranslation()(observer(
    class ConnectionParametersDetails extends React.Component<
        TranslationComponentProps &
        {
            instrument: InstrumentObject;
        }> {
        render() {
            const { instrument } = this.props;
            const { t } = this.props;

            if (instrument.lastConnection) {
                if (instrument.lastConnection.type === "ethernet") {
                    return (
                        <PropertyList>
                            <StaticProperty name="Interface" value="Ethernet" />
                            <StaticProperty
                                name={t("instrument.ServerAddress")}
                                value={
                                    instrument.lastConnection.ethernetParameters
                                        .address
                                }
                            />
                            <StaticProperty
                                name={t("instrument.ServerPort")}
                                value={instrument.lastConnection.ethernetParameters.port.toString()}
                            />
                        </PropertyList>
                    );
                } else if (instrument.lastConnection.type === "serial") {
                    return (
                        <PropertyList>
                            <StaticProperty name="Interface" value="Serial" />
                            <StaticProperty
                                name={t("instrument.SerialPort")}
                                value={
                                    instrument.lastConnection.serialParameters
                                        .port
                                }
                            />
                            <StaticProperty
                                name={t("instrument.BaudRate")}
                                value={instrument.lastConnection.serialParameters.baudRate.toString()}
                            />
                            <StaticProperty
                                name={t("instrument.DataBits")}
                                value={instrument.lastConnection.serialParameters.dataBits.toString()}
                            />
                            <StaticProperty
                                name={t("instrument.StopBits")}
                                value={instrument.lastConnection.serialParameters.stopBits.toString()}
                            />
                            <StaticProperty
                                name={t("instrument.Parity")}
                                value={
                                    instrument.lastConnection.serialParameters
                                        .parity
                                }
                            />
                            <StaticProperty
                                name={t("instrument.FlowControl")}
                                value={
                                    instrument.lastConnection.serialParameters
                                        .flowControl
                                }
                            />
                        </PropertyList>
                    );
                } else if (instrument.lastConnection.type === "usbtmc") {
                    return (
                        <PropertyList>
                            <StaticProperty name="Interface" value="USBTMC" />
                            <StaticProperty
                                name={t("instrument.VendorID")}
                                value={
                                    "0x" +
                                    instrument.lastConnection.usbtmcParameters.idVendor.toString(
                                        16
                                    )
                                }
                            />
                            <StaticProperty
                                name={t("instrument.ProductID")}
                                value={
                                    "0x" +
                                    instrument.lastConnection.usbtmcParameters.idProduct.toString(
                                        16
                                    )
                                }
                            />
                        </PropertyList>
                    );
                } else if (instrument.lastConnection.type === "web-simulator") {
                    return (
                        <PropertyList>
                            <StaticProperty
                                name={t("instrument.WebSimulatoKey")}
                                value={t("instrument.WebSimulatoKeyValue")}
                            />
                        </PropertyList>
                    );
                } else if (instrument.lastConnection.type === "visa") {
                    return (
                        <PropertyList>
                            <StaticProperty name="Interface" value="VISA" />
                            <StaticProperty
                                name={t("instrument.VisaKey")}
                                value={
                                    instrument.lastConnection.visaParameters
                                        .resource
                                }
                            />
                        </PropertyList>
                    );
                }
            }
            return null;
        }
    }
));

////////////////////////////////////////////////////////////////////////////////

export async function installExtension(t: TFunction, instrument: InstrumentObject) {
    const { extensionsCatalog } =
        require("home/extensions-manager/catalog") as typeof CatalogModule;

    const extension = extensionsCatalog.catalog.find(
        extension => extension.id === instrument.extension!.id
    );
    if (extension) {
        const progressToastId = notification.info(
            `${t("instrument.Installing")}`,
            {
                autoClose: false
            });

        const { downloadAndInstallExtension } =
            require("home/extensions-manager/extensions-manager") as typeof ExtensionManagerModule;

        await downloadAndInstallExtension(t, extension, progressToastId);

        notification.update(progressToastId, {
            render: `${t("instrument.InstallSuccess")}`,
            type: notification.SUCCESS,
            autoClose: 500
        });
    } else {
        notification.error(
            `${t("instrument.ExtensionNotFound")}`
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const Properties = withTranslation()(observer(
    class Properties extends React.Component<
        TranslationComponentProps &
        {
            instrument: InstrumentObject;
        },
        {}
    > {
        render() {
            const extension = this.props.instrument.extension;
            const { t } = this.props;
            if (!extension) {
                return null;
            }

            return (
                <PropertyList>
                    <StaticProperty
                        name={t("instrument.Instrument")}
                        value={extension!.displayName || extension!.name}
                    />
                    <StaticProperty
                        name={t("instrument.ID")}
                        value={this.props.instrument.id}
                    />
                    <TextInputProperty
                        name={t("instrument.Label")}
                        value={this.props.instrument.label || ""}
                        onChange={value =>
                            this.props.instrument.setLabel(value)
                        }
                    />
                    <StaticProperty
                        name={t("instrument.IDN")}
                        value={this.props.instrument.idn || ""}
                    />
                    <BooleanProperty
                        name={t("instrument.AutoConnect")}
                        value={this.props.instrument.autoConnect}
                        onChange={value =>
                            this.props.instrument.setAutoConnect(value)
                        }
                    />
                </PropertyList>
            );
        }
    }
));

////////////////////////////////////////////////////////////////////////////////

const Connection = withTranslation()(observer(
    class Connection extends React.Component<
        TranslationComponentProps &
        {
            instrument: InstrumentObject;
        }> {
        connectionParameters: ConnectionParameters | null;

        dismissError = () => {
            this.props.instrument.connection.dismissError();
        };

        render() {
            let { instrument } = this.props;
            const { t } = this.props;

            let connection = this.props.instrument.connection;

            let info;
            let error;
            let connectionParameters;
            let button;

            if (connection) {
                if (connection.isIdle) {
                    error = connection.error && (
                        <AlertDanger onDismiss={this.dismissError}>
                            {connection.error}
                        </AlertDanger>
                    );

                    connectionParameters = (
                        <ConnectionProperties
                            connectionParameters={instrument.getConnectionParameters(
                                [
                                    instrument.lastConnection,
                                    this.connectionParameters,
                                    instrument.defaultConnectionParameters
                                ]
                            )}
                            onConnectionParametersChanged={(
                                connectionParameters: ConnectionParameters
                            ) => {
                                this.connectionParameters =
                                    connectionParameters;
                            }}
                            availableConnections={
                                this.props.instrument.availableConnections
                            }
                            serialBaudRates={
                                this.props.instrument.serialBaudRates
                            }
                        />
                    );

                    button = (
                        <button
                            className="btn btn-success"
                            onClick={() => {
                                if (this.connectionParameters) {
                                    this.props.instrument.setConnectionParameters(
                                        this.connectionParameters
                                    );
                                    this.connectionParameters = null;
                                } else if (!instrument.lastConnection) {
                                    this.props.instrument.setConnectionParameters(
                                        instrument.defaultConnectionParameters
                                    );
                                }
                                connection!.connect();
                            }}
                        >
                            {t("instrument.Connect")}
                        </button>
                    );
                } else {
                    if (connection.isTransitionState) {
                        info = <Loader className="mb-2" />;
                    }

                    connectionParameters = (
                        <ConnectionParametersDetails
                            instrument={this.props.instrument}
                        />
                    );

                    if (connection.isConnected) {
                        button = (
                            <button
                                className="btn btn-danger"
                                onClick={() => connection!.disconnect()}
                            >
                                {t("instrument.Disconnect")}
                            </button>
                        );
                    } else {
                        button = (
                            <button
                                className="btn btn-danger"
                                onClick={() => connection!.disconnect()}
                            >
                                {t("instrument.About")}
                            </button>
                        );
                    }
                }
            }

            return (
                <div>
                    <div>
                        {info}
                        {error}
                        {connectionParameters}
                        <div className="text-left">{button}</div>
                    </div>
                </div>
            );
        }
    }
));
