import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';

describe('Initial Test', () => {
  it('should render correctly', () => {
    const { getByText } = render(
      <View>
        <Text>Hello TravelBuddy</Text>
      </View>
    );
    expect(getByText('Hello TravelBuddy')).toBeTruthy();
  });
});
