import { StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';
import { ChoiceChips } from '@/components/choice-chips';
import { SectionCard } from '@/components/section-card';

type QuestionOption = {
  label: string;
  value: string;
};

type ProgressiveQuestion = {
  key: string;
  title: string;
  helper: string;
  options: QuestionOption[];
};

interface ProgressiveQuestionFlowProps {
  questions: ProgressiveQuestion[];
  values: Record<string, string | undefined>;
  onChange: (key: string, value: string) => void;
}

export function ProgressiveQuestionFlow({
  questions,
  values,
  onChange,
}: ProgressiveQuestionFlowProps) {
  const firstUnansweredIndex = questions.findIndex((question) => values[question.key] === undefined);
  const visibleCount = firstUnansweredIndex === -1 ? questions.length : firstUnansweredIndex + 1;
  const visibleQuestions = questions.slice(0, visibleCount);
  const answeredCount = questions.filter((question) => values[question.key] !== undefined).length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.meta}>
        {answeredCount} of {questions.length} answered
      </Text>

      {visibleQuestions.map((question, index) => (
        <SectionCard
          key={question.key}
          title={question.title}
          subtitle={index === visibleQuestions.length - 1 ? question.helper : 'Answered. Tap again to change it if needed.'}>
          <ChoiceChips
            options={question.options}
            value={values[question.key]}
            onChange={(value) => onChange(question.key, value)}
          />
        </SectionCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: servmorxTheme.spacing.md,
  },
  meta: {
    color: servmorxTheme.colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
