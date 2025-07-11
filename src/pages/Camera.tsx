import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera as CameraIcon, RefreshCw, Zap, Clock, Send, X, ExternalLink, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { subscribeESP32Status, takePhoto, toggleFlash, setPhotoInterval as firebaseSetPhotoInterval, subscribePhotos, deletePhoto } from '@/services/firebase';
import { format } from 'date-fns';
import { toast } from "sonner";
interface ESP32Status {
  flashState: string; // "ON" or "OFF"
  photoIntervalHours: string; // String of float value
  lastUpdate: number;
  ipAddress: string;
  lastPhotoTime?: number;
}
interface Photo {
  id: string;
  imageData: string; // Base64 encoded image data
  timestamp: number;
  caption?: string;
}
const Camera = () => {
  const [status, setStatus] = useState<ESP32Status | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [commandLoading, setCommandLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [photoInterval, setPhotoInterval] = useState<string>('12.0');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Subscribe to ESP32-CAM status
    const unsubscribeStatus = subscribeESP32Status(data => {
      if (data) {
        setStatus(data);
        setPhotoInterval(data.photoIntervalHours || '12.0');
      } else {
        console.log("No ESP32-CAM status data available");
        // Create default status if none exists
        const defaultStatus: ESP32Status = {
          flashState: 'OFF',
          photoIntervalHours: '12.0',
          lastUpdate: Date.now(),
          ipAddress: 'Not connected yet'
        };
        setStatus(defaultStatus);
        setPhotoInterval('12.0');
      }
      setLoading(false);
    });

    // Subscribe to photos from ESP32-CAM
    console.log('Setting up photo subscription');
    setPhotosLoading(true);
    const unsubscribePhotos = subscribePhotos(photos => {
      console.log('Received photos in Camera component:', photos.length);
      setPhotos(photos);
      setPhotosLoading(false);
    });
    return () => {
      unsubscribeStatus();
      unsubscribePhotos();
    };
  }, []);
  const handleTakePhoto = async () => {
    setCommandLoading(true);
    setError(null);
    try {
      await takePhoto();
      toast.success("Photo command sent to ESP32-CAM");
      toast.info("The photo will appear in the gallery once processed");
      setCommandLoading(false);
    } catch (err) {
      setError('Failed to send photo command');
      setCommandLoading(false);
    }
  };
  const handleToggleFlash = async () => {
    setCommandLoading(true);
    setError(null);
    try {
      await toggleFlash();
      // Update local state to provide immediate feedback
      if (status) {
        setStatus({
          ...status,
          flashState: status.flashState === 'ON' ? 'OFF' : 'ON'
        });
      }
      setCommandLoading(false);
    } catch (err) {
      setError('Failed to toggle flash');
      setCommandLoading(false);
    }
  };
  const handleIntervalChange = async () => {
    setCommandLoading(true);
    setError(null);
    try {
      const interval = parseFloat(photoInterval);
      if (isNaN(interval) || interval < 0.25 || interval > 48) {
        throw new Error('Interval must be between 0.25 and 48 hours');
      }
      await firebaseSetPhotoInterval(interval);
      // Update local state to provide immediate feedback
      if (status) {
        setStatus({
          ...status,
          photoIntervalHours: interval.toString()
        });
      }
      setPhotoInterval(interval.toString()); // Convert back to string for state
      setCommandLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change interval');
      setCommandLoading(false);
    }
  };
  const handleDeletePhoto = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteLoading === photoId) return;
    try {
      setDeleteLoading(photoId);
      const success = await deletePhoto(photoId);
      if (success) {
        // If the deleted photo is currently being viewed in the modal, close the modal
        if (selectedPhoto && selectedPhoto.id === photoId) {
          setSelectedPhoto(null);
        }
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
    } finally {
      setDeleteLoading(null);
    }
  };
  const formatTimestamp = (timestamp: number) => {
    try {
      // For timestamp that's stored in milliseconds since epoch
      const date = new Date(timestamp);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (err) {
      console.error('Error formatting date:', err, timestamp);
      return 'Invalid date';
    }
  };
  const openFullSize = (photo: Photo) => {
    setSelectedPhoto(photo);
  };
  const closeFullSize = () => {
    setSelectedPhoto(null);
  };
  const downloadPhoto = (imageData: string, fileName: string) => {
    try {
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = `data:image/jpeg;base64,${imageData}`;
      link.download = fileName || 'plant-photo.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading photo:', error);
      toast.error('Failed to download photo');
    }
  };
  const formatCaption = (caption: string): string => {
    // Check if the caption contains "Plant photo taken on"
    if (caption.includes("Plant photo taken on")) {
      // Extract the date part after "Plant photo taken on"
      const datePart = caption.replace("Plant photo taken on ", "");
      return datePart;
    }
    return caption;
  };
  const renderPhotoGallery = () => {
    if (photosLoading) {
      return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="border rounded-lg overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <div className="p-2">
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>)}
        </div>;
    }
    if (photos.length === 0) {
      return <div className="flex flex-col items-center justify-center p-8 text-center">
          <CameraIcon className="h-12 w-12 mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No photos available yet.</p>
          <p className="text-sm text-muted-foreground/80 mt-2">Take a photo using the controls to see it here!</p>
        </div>;
    }
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map(photo => <div key={photo.id} className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
            <div className="relative aspect-video cursor-pointer" onClick={() => openFullSize(photo)}>
              <img src={`data:image/jpeg;base64,${photo.imageData}`} alt={photo.caption || "Plant photo"} className="object-cover w-full h-full" onError={e => {
            console.error('Error loading image:', photo.id);
            // Fallback image on error
            (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x600?text=Image+Not+Available";
          }} />
            </div>
            <div className="p-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {photo.caption && <p className="text-sm line-clamp-2">
                      {formatCaption(photo.caption)}
                    </p>}
                </div>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => {
                e.stopPropagation();
                downloadPhoto(photo.imageData, `plant-photo-${new Date(photo.timestamp).toISOString().slice(0, 10)}.jpg`);
              }}>
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900" onClick={e => handleDeletePhoto(photo.id, e)} disabled={deleteLoading === photo.id}>
                    {deleteLoading === photo.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>)}
      </div>;
  };
  return <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 pb-16 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Camera Control</h1>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Camera Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CameraIcon className="mr-2 h-5 w-5" />
                ESP32-CAM Controls
              </CardTitle>
              
            </CardHeader>
            <CardContent>
              {loading ? <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div> : <div className="space-y-6">
                  {error && <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>}
                  
                  <div className="flex flex-col space-y-2">
                    <div className="text-sm text-muted-foreground mb-2">
                      Status: {status ? <span className={`font-medium ${status.ipAddress === 'Not connected yet' ? 'text-amber-500' : 'text-green-500'}`}>
                          {status.ipAddress === 'Not connected yet' ? 'Waiting for ESP32-CAM to connect' : `Connected (${status.ipAddress})`}
                        </span> : 'Offline'}
                    </div>
                    
                    <Button onClick={handleTakePhoto} disabled={commandLoading || !status || status.ipAddress === 'Not connected yet'} className="w-full">
                      {commandLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CameraIcon className="mr-2 h-4 w-4" />}
                      Take New Photo
                    </Button>
                    
                    {status?.ipAddress === 'Not connected yet' && <p className="text-xs text-amber-500">
                        Waiting for ESP32-CAM to connect to Firebase. Make sure your ESP32-CAM is powered on and connected to WiFi.
                      </p>}
                  </div>
                  
                  <div className="flex items-center justify-between space-x-4 p-4 border rounded-md">
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <Label htmlFor="flash-toggle">Flash LED</Label>
                    </div>
                    <Switch id="flash-toggle" checked={status?.flashState === 'ON'} onCheckedChange={handleToggleFlash} disabled={commandLoading || !status || status.ipAddress === 'Not connected yet'} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="interval-input" className="flex items-center">
                      <Clock className="mr-2 h-4 w-4" />
                      Auto Photo Interval (hours)
                    </Label>
                    <div className="flex space-x-2">
                      <Input id="interval-input" type="number" min="0.25" max="48" step="0.25" value={photoInterval} onChange={e => setPhotoInterval(e.target.value)} disabled={commandLoading || !status || status.ipAddress === 'Not connected yet'} />
                      <Button onClick={handleIntervalChange} disabled={commandLoading || !status || status.ipAddress === 'Not connected yet'} size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current interval: {status?.photoIntervalHours} hours
                    </p>
                  </div>
                </div>}
            </CardContent>
          </Card>
          
          {/* Photo Gallery */}
          <Card className="md:row-span-2 overflow-hidden">
            <CardHeader>
              <CardTitle>Plant Photo Gallery</CardTitle>
              <CardDescription>
                Photos captured by ESP32-CAM
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[70vh]">
              {renderPhotoGallery()}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Full-size photo modal */}
      {selectedPhoto && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-2 bg-background">
              <p className="text-sm truncate">{formatCaption(selectedPhoto.caption || "Plant photo")}</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => downloadPhoto(selectedPhoto.imageData, `plant-photo-${new Date(selectedPhoto.timestamp).toISOString().slice(0, 10)}.jpg`)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900" onClick={e => handleDeletePhoto(selectedPhoto.id, e)} disabled={deleteLoading === selectedPhoto.id}>
                  {deleteLoading === selectedPhoto.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={closeFullSize}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-950 overflow-auto">
              <img src={`data:image/jpeg;base64,${selectedPhoto.imageData}`} alt={selectedPhoto.caption || "Plant photo"} className="object-contain w-full max-h-[80vh]" onError={e => {
            (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x600?text=Image+Not+Available";
          }} />
            </div>
          </div>
        </div>}
    </div>;
};
export default Camera;