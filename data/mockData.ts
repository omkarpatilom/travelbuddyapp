import { Ride, Booking } from '@/contexts/RideContext';

export const mockRides: Ride[] = [
  {
    id: '1',
    driverId: '2',
    driverName: 'Alice Johnson',
    driverRating: 4.9,
    driverAvatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
    from: {
      address: 'Downtown, San Francisco, CA',
      coordinates: { latitude: 37.7749, longitude: -122.4194 }
    },
    to: {
      address: 'Silicon Valley, Palo Alto, CA',
      coordinates: { latitude: 37.4419, longitude: -122.1430 }
    },
    date: '2024-01-20',
    time: '08:30',
    price: 25,
    availableSeats: 2,
    totalSeats: 3,
    carModel: 'Toyota Camry',
    carColor: 'Blue',
    status: 'active',
    distance: '35 km',
    duration: '45 min'
  },
  {
    id: '2',
    driverId: '3',
    driverName: 'Mike Chen',
    driverRating: 4.7,
    driverAvatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150',
    from: {
      address: 'Oakland, CA',
      coordinates: { latitude: 37.8044, longitude: -122.2712 }
    },
    to: {
      address: 'Berkeley, CA',
      coordinates: { latitude: 37.8715, longitude: -122.2730 }
    },
    date: '2024-01-20',
    time: '09:15',
    price: 15,
    availableSeats: 1,
    totalSeats: 4,
    carModel: 'Honda Civic',
    carColor: 'White',
    status: 'active',
    distance: '15 km',
    duration: '25 min'
  },
  {
    id: '3',
    driverId: '4',
    driverName: 'Sarah Wilson',
    driverRating: 4.8,
    driverAvatar: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=150',
    from: {
      address: 'San Jose, CA',
      coordinates: { latitude: 37.3382, longitude: -121.8863 }
    },
    to: {
      address: 'Santa Clara, CA',
      coordinates: { latitude: 37.3541, longitude: -121.9552 }
    },
    date: '2024-01-21',
    time: '07:45',
    price: 12,
    availableSeats: 3,
    totalSeats: 4,
    carModel: 'Nissan Altima',
    carColor: 'Gray',
    status: 'active',
    distance: '12 km',
    duration: '20 min'
  },
  {
    id: '4',
    driverId: '5',
    driverName: 'David Rodriguez',
    driverRating: 4.6,
    driverAvatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    from: {
      address: 'Fremont, CA',
      coordinates: { latitude: 37.5485, longitude: -121.9886 }
    },
    to: {
      address: 'Hayward, CA',
      coordinates: { latitude: 37.6688, longitude: -122.0808 }
    },
    date: '2024-01-22',
    time: '18:30',
    price: 18,
    availableSeats: 2,
    totalSeats: 3,
    carModel: 'Ford Focus',
    carColor: 'Red',
    status: 'active',
    distance: '20 km',
    duration: '30 min'
  }
];

export const mockBookings: Booking[] = [
  {
    id: '1',
    rideId: '1',
    userId: '1',
    ride: mockRides[0],
    seats: 1,
    totalPrice: 25,
    status: 'confirmed',
    bookingDate: '2024-01-18T10:30:00Z',
    passengerName: 'John Doe',
    passengerPhone: '+1234567890'
  },
  {
    id: '2',
    rideId: '2',
    userId: '1',
    ride: mockRides[1],
    seats: 2,
    totalPrice: 30,
    status: 'completed',
    bookingDate: '2024-01-15T14:20:00Z',
    passengerName: 'John Doe',
    passengerPhone: '+1234567890'
  }
];

export const mockReviews = [
  {
    id: '1',
    userId: '2',
    userName: 'Alice Johnson',
    userAvatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
    rating: 5,
    comment: 'Great ride! Very punctual and friendly driver.',
    date: '2024-01-15'
  },
  {
    id: '2',
    userId: '3',
    userName: 'Mike Chen',
    userAvatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150',
    rating: 4,
    comment: 'Smooth ride, good music, and safe driving.',
    date: '2024-01-12'
  },
  {
    id: '3',
    userId: '4',
    userName: 'Sarah Wilson',
    userAvatar: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=150',
    rating: 5,
    comment: 'Excellent experience! Will definitely book again.',
    date: '2024-01-10'
  }
];