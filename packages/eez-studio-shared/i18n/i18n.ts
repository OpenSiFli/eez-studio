import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { getLocale } from "eez-studio-shared/i10n";
import { WithTranslation } from 'react-i18next';

i18n
    .use(Backend)
    .use(initReactI18next)
    .init({
        backend: {
            loadPath: path.join(__dirname, 'locales/{{lng}}.json')
        },
        lng: getLocale(),
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        },
        debug: true
    });

export const LANGUAGES = {
    "en": "English",
    "zh-CN": "简体中文"
};

export const changeLanguage = (lng: string) => {
    return i18n.changeLanguage(lng);
};

export interface TranslationComponentProps extends WithTranslation {
}
export default i18n;

