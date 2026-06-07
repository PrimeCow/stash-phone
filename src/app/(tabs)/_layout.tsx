import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#e0245e',
        tabBarInactiveTintColor: '#8a8f94',
        tabBarStyle: {
          backgroundColor: '#0a0a0b',
          borderTopColor: '#1f2024',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scenes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="markers"
        options={{
          title: 'Markers',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
