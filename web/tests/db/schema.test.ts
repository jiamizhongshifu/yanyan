/**
 * Schema 完整性测试
 *
 * 不需要真实 DB —— 解析 schema.sql 文本,验证关键约束/列存在。
 * 这保护以下 plan 决策不被静默改动:
 *   - food_classifications 双层标签(中医 + 西方营养连续值)
 *   - symptoms.definition_version 字段(R2 review 修订)
 *   - privacy_consents.scope 5 个 enum 值(R5b 单独同意覆盖)
 *   - 敏感字段密文存储(meals.recognized_items_ciphertext / symptoms.*_ciphertext)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const schemaPath = join(__dirname, '..', '..', 'server', 'db', 'schema.sql');
const schema = readFileSync(schemaPath, 'utf8');

describe('U2 schema integrity', () => {
  test('food_classifications has dual-layer columns (TCM + Western nutrition)', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS food_classifications/);
    expect(schema).toMatch(/tcm_label\s+varchar/);
    expect(schema).toMatch(/tcm_property\s+varchar/);
    expect(schema).toMatch(/dii_score\s+numeric/);
    expect(schema).toMatch(/ages_score\s+numeric/);
    expect(schema).toMatch(/citations\s+jsonb/);
  });

  test('symptoms has definition_version for slider schema versioning (Round 2 review fix)', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS symptoms/);
    expect(schema).toMatch(/definition_version\s+integer/);
  });

  test('symptoms uses ciphertext columns (envelope encryption)', () => {
    expect(schema).toMatch(/blind_input_ciphertext\s+text/);
    expect(schema).toMatch(/severity_ciphertext\s+text/);
  });

  test('meals stores recognized items as ciphertext + plaintext aggregate summaries', () => {
    expect(schema).toMatch(/recognized_items_ciphertext\s+text/);
    expect(schema).toMatch(/tcm_labels_summary\s+jsonb/);
    expect(schema).toMatch(/western_nutrition_summary\s+jsonb/);
  });

  test('privacy_consents.scope covers all 5 PIPL §28 sensitive subcategories', () => {
    const scopeCheck = schema.match(/CHECK\s*\(\s*scope IN\s*\(([^)]+)\)\s*\)/);
    expect(scopeCheck).not.toBeNull();
    const enumValues = scopeCheck![1];
    for (const required of ['health_data', 'medical_report', 'photo_ai', 'location', 'subscribe_push']) {
      expect(enumValues).toContain(`'${required}'`);
    }
  });

  test('users has dek_ciphertext_b64 + consent_version_granted + soft delete', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS users/);
    expect(schema).toMatch(/dek_ciphertext_b64\s+text\s+NOT NULL/);
    expect(schema).toMatch(/consent_version_granted\s+integer/);
    expect(schema).toMatch(/deleted_at\s+timestamptz/);
  });

  test('yan_score_daily has 4 Part columns + breakdown jsonb + level enum', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS yan_score_daily/);
    for (const part of ['food_part', 'symptom_part', 'env_part', 'activity_part']) {
      expect(schema).toMatch(new RegExp(`${part}\\s+numeric`));
    }
    expect(schema).toMatch(/breakdown\s+jsonb/);
    // level enum should include all 4 fire levels and allow NULL (R19 first-day case)
    expect(schema).toMatch(/level\s+varchar\(8\)\s+CHECK[\s\S]*'平'[\s\S]*'微火'[\s\S]*'中火'[\s\S]*'大火'/);
  });
});
