import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera as CameraIcon, RefreshCw, Zap, Clock, Send, X, ExternalLink, Download, Trash2, Activity } from 'lucide-react';
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
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {photos.map(photo => <div key={photo.id} className="modern-card p-0 overflow-hidden hover:border-border transition-all group">
            <div className="relative aspect-video cursor-pointer" onClick={() => openFullSize(photo)}>
              <img 
                src={`data:image/jpeg;base64,${photo.imageData}`} 
                alt={photo.caption || "Plant photo"} 
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" 
                onError={e => {
                  console.error('Error loading image:', photo.id);
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x600?text=Image+Not+Available";
                }} 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
            <div className="p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  {photo.caption && <p className="text-xs text-muted-foreground mono truncate">
                      {formatCaption(photo.caption)}
                    </p>}
                </div>
                <div className="flex space-x-1 ml-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={e => {
                      e.stopPropagation();
                      downloadPhoto(photo.imageData, `plant-photo-${new Date(photo.timestamp).toISOString().slice(0, 10)}.jpg`);
                    }}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" 
                    onClick={e => handleDeletePhoto(photo.id, e)} 
                    disabled={deleteLoading === photo.id}
                  >
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
      
      <main className="container mx-auto px-4 py-6 fade-in">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Camera Controls */}
          <div className="modern-card p-4">
            <div className="flex items-center space-x-2 mb-4">
              <CameraIcon className="h-4 w-4 text-primary" />
              <h2 className="font-medium text-foreground">Camera Controls</h2>
            </div>
            {loading ? <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div> : <div className="space-y-4">
                  {error && <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>}
                  
                  <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50 mb-4">
                    <div className="flex items-center space-x-2">
                      <div className={`status-dot ${status && status.ipAddress !== 'Not connected yet' ? 'status-online' : 'status-warning'}`} />
                      <span className="text-xs font-medium mono">
                        {status && status.ipAddress !== 'Not connected yet' ? 'CONNECTED' : 'WAITING'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mono">
                      {status?.ipAddress || 'No IP'}
                    </span>
                  </div>
                    
                  <Button 
                    onClick={handleTakePhoto} 
                    disabled={commandLoading || !status || status.ipAddress === 'Not connected yet'} 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {commandLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CameraIcon className="mr-2 h-4 w-4" />}
                    Take Photo
                  </Button>
                    
                    {status?.ipAddress === 'Not connected yet' && <p className="text-xs text-amber-500">
                        Waiting for ESP32-CAM to connect to Firebase. Make sure your ESP32-CAM is powered on and connected to WiFi.
                      </p>}
                  </div>
                  
                <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50">
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Flash LED</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground mono">
                        {status?.flashState === 'ON' ? 'ON' : 'OFF'}
                      </span>
                      <Switch 
                        checked={status?.flashState === 'ON'} 
                        onCheckedChange={handleToggleFlash} 
                        disabled={commandLoading || !status || status.ipAddress === 'Not connected yet'}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  </div>
                  
                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Auto Interval</span>
                    </div>
                    <div className="flex space-x-2">
                      <Input 
                        type="number" 
                        min="0.25" 
                        max="48" 
                        step="0.25" 
                        value={photoInterval} 
                        onChange={e => setPhotoInterval(e.target.value)} 
                        disabled={commandLoading || !status || status.ipAddress === 'Not connected yet'}
                        className="bg-card/50 border-border/50"
                        placeholder="Hours"
                      />
                      <Button 
                        onClick={handleIntervalChange} 
                        disabled={commandLoading || !status || status.ipAddress === 'Not connected yet'} 
                        size="icon"
                        variant="outline"
                        className="border-border/50"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mono">
                      Current: {status?.photoIntervalHours}h
                    </p>
                  </div>
              </div>}
          </div>
          
          {/* Photo Gallery */}
          <div className="modern-card p-4 md:row-span-2 overflow-hidden">
            <div className="flex items-center space-x-2 mb-4">
              <CameraIcon className="h-4 w-4 text-primary" />
              <h2 className="font-medium text-foreground">Photo Gallery</h2>
              <span className="text-xs text-muted-foreground mono">
                {photos.length} photos
              </span>
            </div>
            <div className="overflow-auto max-h-[70vh]">
              {renderPhotoGallery()}
            </div>
          </div>
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