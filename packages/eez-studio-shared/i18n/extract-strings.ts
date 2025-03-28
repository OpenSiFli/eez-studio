import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface StringInfo {
    key: string;
    value: string;
    file: string;
    line: number;
    type: 'quoted' | 'jsx' | 'template';
}

export async function extractStrings(sourceDir: string, outputFile: string) {
    const strings: StringInfo[] = [];

    // 查找所有 tsx 和 ts 文件
    const files = await glob('**/*.{tsx,ts}', {
        cwd: sourceDir,
        ignore: ['**/node_modules/**', '**/dist/**']
    });

    for (const file of files) {
        const content = fs.readFileSync(path.join(sourceDir, file), 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // 1. 匹配双引号字符串
            const quotedRegex = /"([^"]+)"/g;
            let match;
            while ((match = quotedRegex.exec(line)) !== null) {
                const value = match[1];
                if (shouldExtract(value)) {
                    strings.push({
                        key: generateKey(value),
                        value,
                        file,
                        line: index + 1,
                        type: 'quoted'
                    });
                }
            }

            // 2. 匹配JSX标签中的文本
            const jsxRegex = /<[^>]*>([^<]+)<\/[^>]*>/g;
            while ((match = jsxRegex.exec(line)) !== null) {
                const value = match[1].trim();
                if (shouldExtract(value)) {
                    strings.push({
                        key: generateKey(value),
                        value,
                        file,
                        line: index + 1,
                        type: 'jsx'
                    });
                }
            }

            // 3. 匹配模板字符串
            const templateRegex = /`([^`]+)`/g;
            while ((match = templateRegex.exec(line)) !== null) {
                const value = match[1];
                // 只提取不包含插值的模板字符串
                if (!value.includes('${') && shouldExtract(value)) {
                    strings.push({
                        key: generateKey(value),
                        value,
                        file,
                        line: index + 1,
                        type: 'template'
                    });
                }
            }
        });
    }

    // 按文件分组
    const groupedStrings = strings.reduce((acc, str) => {
        const dir = path.dirname(str.file);
        if (!acc[dir]) {
            acc[dir] = [];
        }
        acc[dir].push(str);
        return acc;
    }, {} as Record<string, StringInfo[]>);

    // 生成翻译文件
    for (const [dir, strs] of Object.entries(groupedStrings)) {
        const namespace = path.basename(dir);
        const translations = strs.reduce((acc, str) => {
            acc[str.key] = str.value;
            return acc;
        }, {} as Record<string, string>);

        // 写入英文翻译文件
        const enPath = path.join(sourceDir, 'locales', 'en', `${namespace}.json`);
        fs.mkdirSync(path.dirname(enPath), { recursive: true });
        fs.writeFileSync(enPath, JSON.stringify(translations, null, 2));

        // 写入中文翻译文件
        const zhPath = path.join(sourceDir, 'locales', 'zh', `${namespace}.json`);
        fs.mkdirSync(path.dirname(zhPath), { recursive: true });
        fs.writeFileSync(zhPath, JSON.stringify(translations, null, 2));
    }

    // 生成报告
    const report = strings.map(str =>
        `${str.file}:${str.line} - [${str.type}] "${str.value}" -> ${str.key}`
    ).join('\n');

    fs.writeFileSync(outputFile, report);
}

function shouldExtract(value: string): boolean {
    // 过滤规则
    return (
        // 长度大于1
        value.length > 1 &&
        // 不是纯数字
        !value.match(/^[0-9]+$/) &&
        // 不是变量名
        !value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/) &&
        // 不包含特殊字符
        !value.match(/[<>{}]/) &&
        // 不是空字符串或纯空格
        value.trim().length > 0 &&
        // 不是常见的HTML标签
        !value.match(/^(div|span|p|h1|h2|h3|h4|h5|h6|button|input|label)$/i) &&
        // 不是常见的CSS类名
        !value.match(/^(container|row|col|btn|form-control)$/i)
    );
}

function generateKey(value: string): string {
    return value
        .toLowerCase()
        // 移除HTML标签
        .replace(/<[^>]*>/g, '')
        // 替换非字母数字字符为下划线
        .replace(/[^a-z0-9]+/g, '_')
        // 移除首尾下划线
        .replace(/^_+|_+$/g, '')
        // 限制长度
        .slice(0, 50);
} 