import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Подставляет `{{key}}` в HTML из `mail-templates/dist` (собрано из MJML).
 */
@Injectable()
export class MailTemplateService {
  private readonly logger = new Logger(MailTemplateService.name);
  private readonly templatesRoot = path.join(
    process.cwd(),
    'mail-templates',
    'dist',
  );

  hasTemplate(slug: string): boolean {
    return fs.existsSync(path.join(this.templatesRoot, `${slug}.html`));
  }

  render(slug: string, variables: Record<string, string>): string {
    const file = path.join(this.templatesRoot, `${slug}.html`);
    if (!fs.existsSync(file)) {
      this.logger.warn(`Mail template missing: ${file}`);
      throw new Error(`Mail template not found: ${slug}`);
    }
    let html = fs.readFileSync(file, 'utf8');
    for (const [key, value] of Object.entries(variables)) {
      const token = `{{${key}}}`;
      html = html.split(token).join(value);
    }
    if (html.includes('{{')) {
      this.logger.warn(
        `Mail template "${slug}" may contain unreplaced placeholders`,
      );
    }
    return html;
  }
}
