/**
 * Public Landing → Quiz → Result 流程测试
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { Landing } from '../pages/Landing';
import { QuizStep1Goal } from '../pages/Quiz/Step1Goal';
import { QuizStep2Symptoms } from '../pages/Quiz/Step2Symptoms';
import { QuizStep3Lifestyle } from '../pages/Quiz/Step3Lifestyle';
import { QuizResult } from '../pages/Quiz/Result';
import { computeInflammationIndex } from '../services/quiz';
import { useQuiz } from '../store/quiz';

beforeEach(() => {
  localStorage.clear();
  useQuiz.getState().reset();
});

describe('U-Quiz Landing', () => {
  test('Landing 公开渲染 + CTA', () => {
    render(
      <Router hook={memoryLocation({ path: '/' }).hook}>
        <Landing />
      </Router>
    );
    expect(screen.getByTestId('landing')).toBeInTheDocument();
    expect(screen.getByTestId('cta-quiz').getAttribute('href')).toBe('/quiz/step1');
  });
});

describe('U-Quiz Step1', () => {
  test('Step1 选项写入 quiz store', () => {
    render(
      <Router hook={memoryLocation({ path: '/quiz/step1' }).hook}>
        <QuizStep1Goal />
      </Router>
    );
    fireEvent.click(screen.getByTestId('quiz-choice-rhinitis'));
    expect(useQuiz.getState().reverseFilterChoice).toBe('rhinitis');
    // 下一步按钮启用
    expect(screen.getByTestId('quiz-step1-next').hasAttribute('disabled')).toBe(false);
  });
});

describe('U-Quiz Step2', () => {
  test('点击 cell 写入 + 再点取消', () => {
    render(
      <Router hook={memoryLocation({ path: '/quiz/step2' }).hook}>
        <QuizStep2Symptoms />
      </Router>
    );
    fireEvent.click(screen.getByTestId('quiz-cell-acne-often'));
    expect(useQuiz.getState().symptomsFrequency.acne).toBe('often');
    fireEvent.click(screen.getByTestId('quiz-cell-acne-often'));
    expect(useQuiz.getState().symptomsFrequency.acne).toBeUndefined();
  });
});

describe('U-Quiz Step3', () => {
  test('两题都选才能提交,提交后 markCompleted', () => {
    render(
      <Router hook={memoryLocation({ path: '/quiz/step3' }).hook}>
        <QuizStep3Lifestyle />
      </Router>
    );
    expect((screen.getByTestId('quiz-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('quiz-diet-mostly_outside_or_spicy'));
    fireEvent.click(screen.getByTestId('quiz-sleep-short_or_late'));
    expect((screen.getByTestId('quiz-submit') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('quiz-submit'));
    expect(useQuiz.getState().completedAt).not.toBeNull();
  });
});

describe('U-Quiz Result', () => {
  test('未完成 quiz 时不渲染 result(自动跳走)', () => {
    render(
      <Router hook={memoryLocation({ path: '/quiz/result' }).hook}>
        <QuizResult />
      </Router>
    );
    // useEffect 异步触发跳转,渲染时 completedAt=null → return null
    expect(screen.queryByTestId('quiz-result')).not.toBeInTheDocument();
  });

  test('完成 quiz 后展示分数 + 等级 + 锁定预览 + 登录 CTA', () => {
    useQuiz.getState().setReverseFilterChoice('rhinitis');
    useQuiz.getState().setSymptomsFrequency({
      nasal_congestion: 'often',
      acne: 'often',
      dry_mouth: 'often',
      bowel: 'sometimes',
      fatigue: 'often',
      edema: 'sometimes',
      throat_itch: 'sometimes'
    });
    useQuiz.getState().setRecentDiet('mostly_outside_or_spicy');
    useQuiz.getState().setSleepPattern('short_or_late');
    useQuiz.getState().markCompleted();

    render(
      <Router hook={memoryLocation({ path: '/quiz/result' }).hook}>
        <QuizResult />
      </Router>
    );
    expect(screen.getByTestId('quiz-result')).toBeInTheDocument();
    // 抗炎指数:重症 + 生活差 → 微暖 / 留心
    expect(['微暖', '留心']).toContain(screen.getByTestId('result-level').textContent);
    // CTA 现在是 button + onClick navigate(),不再是 Link
    const cta = screen.getByTestId('cta-login');
    expect(cta.tagName.toLowerCase()).toBe('button');
    expect(cta.textContent).toMatch(/登录解锁/);
  });
});

describe('inflammation index pure function', () => {
  test('全空答案 → score=0 + 等级 平', () => {
    const idx = computeInflammationIndex({
      reverseFilterChoice: null,
      symptomsFrequency: {},
      recentDiet: null,
      sleepPattern: null
    });
    expect(idx.score).toBe(0);
    expect(idx.level).toBe('平');
    expect(idx.completeness).toBe(0);
  });

  test('全经常 + 不规律生活 → 大火', () => {
    const idx = computeInflammationIndex({
      reverseFilterChoice: 'rhinitis',
      symptomsFrequency: {
        nasal_congestion: 'often',
        acne: 'often',
        dry_mouth: 'often',
        bowel: 'often',
        fatigue: 'often',
        edema: 'often',
        throat_itch: 'often'
      },
      recentDiet: 'mostly_outside_or_spicy',
      sleepPattern: 'short_or_late'
    });
    expect(idx.score).toBeGreaterThanOrEqual(75);
    expect(idx.level).toBe('大火');
    expect(idx.completeness).toBe(1);
  });

  test('完整度按回答数累加', () => {
    const idx = computeInflammationIndex({
      reverseFilterChoice: 'rhinitis',
      symptomsFrequency: { acne: 'sometimes' },
      recentDiet: 'mixed',
      sleepPattern: null
    });
    // 1 dim + 1 lifestyle = 2/9
    expect(idx.completeness).toBeCloseTo(2 / 9, 1);
  });
});
