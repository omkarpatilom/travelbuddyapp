import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/utils/api';
import { ArrowLeft, Star, TrendingUp, Award, Users } from 'lucide-react-native';

export default function ReviewsScreen() {
  const [activeTab, setActiveTab] = useState<'received' | 'given'>('received');
  const [receivedReviews, setReceivedReviews] = useState<any[]>([]);
  const [givenReviews, setGivenReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch received reviews
      const received = await api.get<any[]>(`/Reviews/user/${user.id}`);
      setReceivedReviews(received);
      
      // Backend doesn't seem to have a dedicated "given reviews" endpoint for current user yet
      // but we might be able to filter from somewhere else if needed.
      // For now we just use received reviews.
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = () => {
    const total = receivedReviews.length;
    if (total === 0) return { totalReviews: 0, averageRating: 5.0, ratingDistribution: [0, 0, 0, 0, 0] };
    
    const average = receivedReviews.reduce((sum, review) => sum + review.rating, 0) / total;
    const distribution = [5, 4, 3, 2, 1].map(rating => 
      receivedReviews.filter(review => review.rating === rating).length
    );
    
    return { totalReviews: total, averageRating: average, ratingDistribution: distribution };
  };

  const { totalReviews, averageRating, ratingDistribution } = calculateStats();

  const renderReview = ({ item }: { item: any }) => (
    <View style={[styles.reviewCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.reviewHeader}>
        {item.reviewerAvatar ? (
          <Image source={{ uri: item.reviewerAvatar }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <Users size={20} color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.reviewInfo}>
          <Text style={[styles.userName, { color: theme.colors.text }]}>{item.reviewerName || 'Anonymous'}</Text>
          <View style={styles.ratingContainer}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                size={14}
                color={index < item.rating ? theme.colors.warning : theme.colors.border}
                fill={index < item.rating ? theme.colors.warning : 'transparent'}
              />
            ))}
            <Text style={[styles.ratingText, { color: theme.colors.textSecondary }]}>
              {item.rating}/5
            </Text>
          </View>
        </View>
        <Text style={[styles.reviewDate, { color: theme.colors.textSecondary }]}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      
      {item.comment && (
        <Text style={[styles.reviewComment, { color: theme.colors.text }]}>
          "{item.comment}"
        </Text>
      )}
    </View>
  );

  const renderRatingBar = (rating: number, count: number) => {
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    
    return (
      <View key={rating} style={styles.ratingBarContainer}>
        <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]}>
          {rating}★
        </Text>
        <View style={[styles.ratingBarTrack, { backgroundColor: theme.colors.surface }]}>
          <View 
            style={[
              styles.ratingBarFill, 
              { backgroundColor: theme.colors.warning, width: `${percentage}%` }
            ]} 
          />
        </View>
        <Text style={[styles.ratingCount, { color: theme.colors.textSecondary }]}>
          {count}
        </Text>
      </View>
    );
  };

  if (isLoading && receivedReviews.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Reviews & Ratings</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Rating Overview */}
        <View style={[styles.overviewCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.overviewHeader}>
            <View style={styles.ratingOverview}>
              <Text style={[styles.averageRating, { color: theme.colors.primary }]}>
                {averageRating.toFixed(1)}
              </Text>
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    size={20}
                    color={index < Math.floor(averageRating) ? theme.colors.warning : theme.colors.border}
                    fill={index < Math.floor(averageRating) ? theme.colors.warning : 'transparent'}
                  />
                ))}
              </View>
              <Text style={[styles.totalReviews, { color: theme.colors.textSecondary }]}>
                Based on {totalReviews} reviews
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <TrendingUp size={20} color={theme.colors.secondary} />
                <Text style={[styles.statNumber, { color: theme.colors.secondary }]}>
                  {totalReviews > 0 ? ((receivedReviews.filter(r => r.rating >= 4).length / totalReviews) * 100).toFixed(0) : 0}%
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Positive
                </Text>
              </View>
              <View style={styles.statItem}>
                <Award size={20} color={theme.colors.accent} />
                <Text style={[styles.statNumber, { color: theme.colors.accent }]}>
                  {receivedReviews.filter(r => r.rating === 5).length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  5-Star
                </Text>
              </View>
              <View style={styles.statItem}>
                <Users size={20} color={theme.colors.primary} />
                <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
                  {user?.totalRides || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Total Rides
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.ratingDistribution}>
            <Text style={[styles.distributionTitle, { color: theme.colors.text }]}>
              Rating Distribution
            </Text>
            {ratingDistribution.map((count, index) => 
              renderRatingBar(5 - index, count)
            )}
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'received' && { backgroundColor: theme.colors.primary }]}
            onPress={() => setActiveTab('received')}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'received' ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              Received ({receivedReviews.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'given' && { backgroundColor: theme.colors.primary }]}
            onPress={() => setActiveTab('given')}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'given' ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              Given ({givenReviews.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reviews List */}
        <FlatList
          data={activeTab === 'received' ? receivedReviews : givenReviews}
          keyExtractor={(item) => item.id}
          renderItem={renderReview}
          contentContainerStyle={styles.reviewsList}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Star size={60} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No reviews yet
              </Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {activeTab === 'received' 
                  ? 'Complete more rides to receive reviews from passengers'
                  : 'Rate your completed rides to help other users'
                }
              </Text>
            </View>
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  overviewCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 24,
  },
  overviewHeader: {
    flexDirection: 'row',
    gap: 24,
  },
  ratingOverview: {
    flex: 1,
    alignItems: 'center',
  },
  averageRating: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  totalReviews: {
    fontSize: 14,
  },
  statsGrid: {
    flex: 1,
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
  },
  ratingDistribution: {
    gap: 12,
  },
  distributionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  ratingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingLabel: {
    fontSize: 14,
    width: 30,
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  ratingCount: {
    fontSize: 14,
    width: 30,
    textAlign: 'right',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewsList: {
    gap: 16,
  },
  reviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    marginLeft: 4,
  },
  reviewDate: {
    fontSize: 12,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
