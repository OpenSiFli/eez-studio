import React from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";

import { Loader } from "eez-studio-ui/loader";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";
import { ModuleItem } from "instrument/bb3/components/modules-section/ModuleItem";
import { InstrumentAppStore } from "instrument/window/app-store";

export const ModulesSection = observer(
    ({
        bb3Instrument,
        appStore
    }: {
        bb3Instrument: BB3Instrument;
        appStore: InstrumentAppStore;
    }) => {
        const { t } = useTranslation();
        const isConnected = bb3Instrument.instrument.isConnected;

        let body;

        if (bb3Instrument.refreshInProgress) {
            body = <Loader />;
        } else if (bb3Instrument.modules) {
            body = (
                <>
                    <table className="table mb-0 border EezStudio_Table">
                        <thead>
                            <tr>
                                <th>{t("instrument.modulesSection.Headers.Slot")}</th>
                                <th>{t("instrument.modulesSection.Headers.Model")}</th>
                                <th>{t("instrument.modulesSection.Headers.Revision")}</th>
                                <th>{t("instrument.modulesSection.Headers.Firmware")}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {bb3Instrument.modules.map(module => (
                                <ModuleItem
                                    key={module.slotIndex}
                                    module={module}
                                />
                            ))}
                        </tbody>
                    </table>
                    {isConnected && (
                        <button
                            className="btn btn-primary"
                            onClick={bb3Instrument.uploadPinoutPages}
                            style={{ marginTop: 20 }}
                            disabled={bb3Instrument.busy}
                        >
                            {t("instrument.modulesSection.UploadPinoutPages")}
                        </button>
                    )}
                </>
            );
        } else {
            body = (
                <div className="alert alert-danger" role="alert">
                    {t("instrument.modulesSection.FetchError")}
                </div>
            );
        }

        return <Section title={t("instrument.modulesSection.Title")} body={body} />;
    }
);
