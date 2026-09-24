import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { researchPalette } from './researchTheme';

export interface AnswerOption {
  /** Stable value, used as the answer for storage. Not participant-facing. */
  value: string;
  /** Participant-facing label. */
  label: string;
  /** Optional secondary description shown under the label (list controls). */
  description?: string;
}

interface LikertScaleProps {
  options: ReadonlyArray<AnswerOption>;
  selected: string | null;
  onSelect: (value: string) => void;
  accessibilityLabelPrefix?: string;
  testID?: string;
}

// Compact horizontal scale used for frequency/agreement questions.
export const LikertScale: React.FC<LikertScaleProps> = ({
  options,
  selected,
  onSelect,
  accessibilityLabelPrefix,
  testID,
}) => {
  return (
    <View
      style={styles.scaleRow}
      testID={testID}
      accessibilityRole="radiogroup"
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={
              accessibilityLabelPrefix
                ? `${accessibilityLabelPrefix}: ${option.label}`
                : option.label
            }
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.scaleChip,
              isSelected && styles.scaleChipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.scaleChipLabel,
                isSelected && styles.scaleChipLabelSelected,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

interface SelectionListProps {
  options: ReadonlyArray<AnswerOption>;
  selected: string | null;
  onSelect: (value: string) => void;
  multiple?: boolean;
  accessibilityLabelPrefix?: string;
  testID?: string;
}

// Vertical single/multi-select list used for reflective choices
// (e.g. domain confirmation candidates).
export const SelectionList: React.FC<SelectionListProps> = ({
  options,
  selected,
  onSelect,
  multiple = false,
  accessibilityLabelPrefix,
  testID,
}) => {
  const isSelected = (value: string) =>
    multiple
      ? (selected?.split(',') ?? []).includes(value)
      : selected === value;

  return (
    <View
      style={styles.list}
      testID={testID}
      accessibilityRole={multiple ? undefined : 'radiogroup'}
    >
      {options.map((option) => {
        const active = isSelected(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={
              accessibilityLabelPrefix
                ? `${accessibilityLabelPrefix}: ${option.label}`
                : option.label
            }
            accessibilityState={{ checked: active, selected: active }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.listRow,
              active && styles.listRowSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.listTextColumn}>
              <Text
                style={[styles.listLabel, active && styles.listLabelActive]}
              >
                {option.label}
              </Text>
              {option.description ? (
                <Text style={styles.listDescription}>{option.description}</Text>
              ) : null}
            </View>
            <View style={[styles.indicator, active && styles.indicatorActive]}>
              {active ? <View style={styles.indicatorDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scaleChip: {
    minHeight: 44,
    minWidth: 66,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: researchPalette.border,
    backgroundColor: researchPalette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleChipSelected: {
    borderColor: researchPalette.accent,
    backgroundColor: researchPalette.accentSoft,
  },
  scaleChipLabel: {
    fontSize: 13,
    color: researchPalette.muted,
    fontWeight: '500',
  },
  scaleChipLabelSelected: {
    color: researchPalette.text,
  },
  pressed: {
    opacity: 0.7,
  },
  list: {
    gap: 10,
  },
  listRow: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: researchPalette.border,
    backgroundColor: researchPalette.surface,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  listRowSelected: {
    borderColor: researchPalette.accent,
    backgroundColor: researchPalette.accentSoft,
  },
  listTextColumn: {
    flex: 1,
    gap: 3,
  },
  listLabel: {
    fontSize: 16,
    lineHeight: 22,
    color: researchPalette.text,
    fontWeight: '500',
  },
  listLabelActive: {
    color: researchPalette.text,
  },
  listDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: researchPalette.muted,
  },
  indicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: researchPalette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorActive: {
    borderColor: researchPalette.accent,
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: researchPalette.accent,
  },
});