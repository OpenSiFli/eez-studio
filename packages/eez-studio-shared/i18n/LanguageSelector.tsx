import React from 'react';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';

const languages = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '简体中文' }
];

export const LanguageSelector: React.FC = () => {
    const { i18n } = useTranslation();

    const handleLanguageChange = (option: any) => {
        i18n.changeLanguage(option.value);
    };

    return (
        <Select
            options={languages}
            value={languages.find(lang => lang.value === i18n.language)}
            onChange={handleLanguageChange}
            className="language-selector"
        />
    );
};
