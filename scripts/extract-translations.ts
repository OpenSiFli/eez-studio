import { extractStrings } from '../packages/eez-studio-shared/i18n/extract-strings';
import path from 'path';
import fs from 'fs';

console.log('开始提取翻译字符串...');

async function main() {
    try {
        const sourceDir = path.resolve(__dirname, '..');
        const outputFile = path.join(sourceDir, 'translation-report.txt');

        // 确保输出目录存在
        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 运行提取
        await extractStrings(sourceDir, outputFile);

        console.log('翻译字符串提取完成！');
        console.log(`报告文件已生成: ${outputFile}`);
    } catch (error) {
        console.error('提取过程中发生错误:', error);
        process.exit(1);
    }
}

main(); 