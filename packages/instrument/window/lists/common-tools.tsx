import React from "react";
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";
import { I18nContext } from "react-i18next";
import i18n from "i18next";

import type {
    IAxisController,
    IChartsController
} from "eez-studio-ui/chart/chart";
import { ListAxisModel } from "instrument/window/lists/store-renderer";

////////////////////////////////////////////////////////////////////////////////

export const displayOption = observable.box<string>(
    localStorage.getItem("instrument/window/lists/displayOption") || "split"
);

export type ChartsDisplayOption = "split" | "voltage" | "current" | "both";

////////////////////////////////////////////////////////////////////////////////

export const CommonTools = observer(
    class CommonTools extends React.Component<
        { chartsController: IChartsController },
        {}
    > {
        static contextType = I18nContext;
        declare context: React.ContextType<typeof I18nContext>;

        constructor(props: { chartsController: IChartsController }) {
            super(props);

            makeObservable(this, {
                onDisplayOptionChange: action
            });
        }

        onDisplayOptionChange(event: React.ChangeEvent<HTMLSelectElement>) {
            displayOption.set(event.target.value);
            localStorage.setItem(
                "instrument/window/lists/displayOption",
                displayOption.get()
            );
        }

        zoomToFitRange = () => {
            function zoom(axisController: IAxisController | undefined) {
                if (!axisController) {
                    return;
                }

                const listAxisModel = axisController.axisModel as ListAxisModel;

                const range = listAxisModel.list.getRange(listAxisModel);

                const from = Math.max(
                    listAxisModel.minValue,
                    range.from - 0.05 * (range.to - range.from)
                );

                const to = Math.min(
                    listAxisModel.maxValue,
                    range.to + 0.05 * (range.to - range.from)
                );

                axisController.zoom(from, to);
            }

            for (const chartController of this.props.chartsController
                .chartControllers) {
                zoom(chartController.yAxisController);
                zoom(chartController.yAxisControllerOnRightSide);
            }
        };

        render() {
            const i18nInstance = (this.context && this.context.i18n) || i18n;
            const t = i18nInstance.t.bind(i18nInstance);

            return (
                <table>
                    <tbody>
                        <tr>
                            {this.props.chartsController && (
                                <td>
                                    <button
                                        className="btn btn-secondary"
                                        title={t("instrument.commonTools.ZoomAllTitle")}
                                        onClick={
                                            this.props.chartsController.zoomAll
                                        }
                                        style={{
                                            marginRight: 10
                                        }}
                                    >
                                        {t("instrument.commonTools.ZoomAllButton")}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        title={t("instrument.commonTools.ZoomFitTitle")}
                                        onClick={this.zoomToFitRange}
                                    >
                                        {t("instrument.commonTools.ZoomFitButton")}
                                    </button>
                                </td>
                            )}
                            <td>
                                <label>{t("instrument.commonTools.DisplayLabel")}</label>
                            </td>
                            <td>
                                <label className="form-check-label">
                                    <select
                                        className="form-select"
                                        value={displayOption.get()}
                                        onChange={this.onDisplayOptionChange}
                                    >
                                        <option value="split">
                                            {t("instrument.commonTools.DisplayOptions.split")}
                                        </option>
                                        <option value="voltage">
                                            {t("instrument.commonTools.DisplayOptions.voltage")}
                                        </option>
                                        <option value="current">
                                            {t("instrument.commonTools.DisplayOptions.current")}
                                        </option>
                                        <option value="both">
                                            {t("instrument.commonTools.DisplayOptions.both")}
                                        </option>
                                    </select>
                                </label>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    }
);
