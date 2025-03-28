import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { getLocale, setLocale } from "eez-studio-shared/i10n";

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

// 提供一个切换语言的函数
export const changeLanguage = (lng: string) => {
    setLocale(lng);
    return i18n.changeLanguage(lng);
};

export default i18n;

