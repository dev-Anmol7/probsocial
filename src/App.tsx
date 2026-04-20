/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, ReactNode, useMemo, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Plus, 
  LayoutGrid, 
  PlusCircle, 
  User as UserIcon,
  Rss,
  Map as MapIcon,
  FileText,
  Gavel,
  X,
  Send,
  Flag,
  ChevronRight,
  TrendingUp,
  Award,
  Camera,
  Video,
  Image as ImageIcon,
  Paperclip,
  LogOut,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  setDoc,
  getDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorDept: string;
  authorAvatar: string;
  title: string;
  content: string;
  status: 'In Review' | 'Resolved' | 'Urgent' | 'Discussion';
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  locationUrl?: string;
  upvotes: number;
  downvotes: number;
  commentsCount: number;
  createdAt: any;
  category: string;
  voters?: Record<string, number>; // uid: 1 or -1
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  department: string;
  avatar: string;
  biography: string;
  impactPoints: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeNav, setActiveNav] = useState('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'urgent' | 'popular'>('urgent');
  const [toast, setToast] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth & Profile Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          // Create initial profile
          const newProfile: UserProfile = {
            uid: user.uid,
            name: user.displayName || 'Anonymous Student',
            email: user.email || '',
            department: 'UNDECIDED',
            avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/200/200`,
            biography: 'New advocate in the campus movement.',
            impactPoints: 0
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // Posts Real-time Sync
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      setPosts(fetchedPosts);
    });
    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Authenticated. Welcome back.');
    } catch (error) {
      showToast('Login failed. Google verify required.');
    }
  };

  const handleLogout = () => {
    signOut(auth);
    showToast('Session ended.');
  };

  const filteredPosts = useMemo(() => {
    let result = posts.filter(post => 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === 'popular') {
      result = [...result].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    }

    return result;
  }, [posts, searchQuery, sortBy]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreatePost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !profile) return;

    const formData = new FormData(e.currentTarget);
    
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: profile.name,
        authorDept: profile.department,
        authorAvatar: profile.avatar,
        title: formData.get('title') as string,
        content: formData.get('description') as string,
        status: 'Discussion',
        locationUrl: formData.get('locationUrl') as string,
        mediaUrl: mediaPreview?.url || null,
        mediaType: mediaPreview?.type || null,
        upvotes: 0,
        downvotes: 0,
        commentsCount: 0,
        voters: {},
        createdAt: serverTimestamp(),
        category: formData.get('category') as string,
      });

      setIsPostModalOpen(false);
      setMediaPreview(null);
      showToast('Post live on Campus Wall.');
    } catch (error) {
      showToast('Submission failed. Check rules.');
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video') ? 'video' : 'image';
      setMediaPreview({ url, type });
    }
  };

  const handleDeletePost = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'posts', id));
      showToast('Post removed.');
    } catch (error) {
      showToast('Action denied.');
    }
  };

  const handleVote = async (id: string, type: 'up' | 'down') => {
    if (!user) return;
    const postRef = doc(db, 'posts', id);
    const post = posts.find(p => p.id === id);
    if (!post) return;

    const currentVote = post.voters?.[user.uid] || 0;
    const newVote = type === 'up' ? 1 : -1;

    let upDelta = 0;
    let downDelta = 0;

    if (currentVote === newVote) {
      // Remove vote
      if (newVote === 1) upDelta = -1;
      else downDelta = -1;
      
      const newVoters = { ...post.voters };
      delete newVoters[user.uid];
      
      await updateDoc(postRef, {
        upvotes: increment(upDelta),
        downvotes: increment(downDelta),
        voters: newVoters
      });
    } else {
      // Change or add vote
      if (currentVote === 1) upDelta = -1;
      if (currentVote === -1) downDelta = -1;
      
      if (newVote === 1) upDelta += 1;
      else downDelta += 1;

      await updateDoc(postRef, {
        upvotes: increment(upDelta),
        downvotes: increment(downDelta),
        [`voters.${user.uid}`]: newVote
      });
    }
  };

  const handleAddComment = async (postId: string, text: string) => {
    if (!text.trim() || !user || !profile) return;
    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        authorId: user.uid,
        authorName: profile.name,
        text,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1)
      });
      showToast('Contribution added.');
    } catch (error) {
      showToast('Failed to comment.');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const updates = {
      department: formData.get('department') as string,
      biography: formData.get('biography') as string,
    };
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      showToast('Profile updated.');
    } catch (error) {
      showToast('Update failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
          <TrendingUp size={48} className="text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col md:flex-row font-sans selection:bg-primary selection:text-on-primary text-[15px]">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-[320px] border-r-2 border-outline p-8 flex-col justify-between bg-surface sticky top-0 h-screen">
        <div className="space-y-12">
          <div className="space-y-1">
            <h1 className="text-5xl font-black leading-none tracking-tighter uppercase italic text-shadow-sm">
              Campus<br />Wall
            </h1>
            <p className="text-[10px] font-black tracking-[0.2em] text-primary uppercase mt-2">
              The Digital Broadside
            </p>
          </div>

          <nav className="space-y-4">
            <DesktopNavLink 
              active={activeNav === 'feed'} 
              onClick={() => setActiveNav('feed')} 
              icon={<Rss size={24} />} 
              label="The Forum" 
            />
            <DesktopNavLink 
              active={activeNav === 'reports'} 
              onClick={() => setActiveNav('reports')} 
              icon={<FileText size={24} />} 
              label="My Activity" 
            />
          </nav>

          <div className="space-y-4 pt-8 border-t-2 border-outline">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest">Live Pulse</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold">1,240 Online</span>
              </span>
            </div>
            <p className="text-[10px] font-medium leading-relaxed opacity-60">
              The collective student voice is currently analyzing 42 campus trends.
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02, x: 4, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsPostModalOpen(true)}
          className="p-6 bg-primary text-on-primary border-2 border-outline brutalist-shadow flex flex-col items-center justify-center text-center space-y-2 group"
        >
          <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
          <p className="text-sm font-black uppercase tracking-widest leading-none">New Post</p>
        </motion.button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <header className="h-24 md:h-28 border-b-2 border-outline flex items-center justify-between px-6 md:px-10 bg-surface md:sticky md:top-0 z-30">
          <div className="flex gap-4 md:gap-12 flex-1">
            <div className="flex flex-col relative w-full max-w-xs group">
               <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest mb-1">Search the forum</span>
               <div className="relative">
                 <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full bg-surface-container-low border-2 border-outline px-4 py-2 font-artistic text-lg focus:outline-none focus:bg-surface-variant transition-colors"
                 />
                 <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" size={18} />
               </div>
            </div>
            
            <div className="hidden sm:flex flex-col cursor-pointer" onClick={() => setSortBy(sortBy === 'urgent' ? 'popular' : 'urgent')}>
              <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest mb-1">Curation</span>
              <span className="text-xl font-artistic flex items-center gap-2 hover:text-primary transition-colors">
                {sortBy === 'urgent' ? 'Hot & Recent' : 'Top Voted'}
                <ChevronRight size={16} className="rotate-90" />
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6 ml-4">
            <button onClick={handleLogout} className="text-on-surface-variant hover:text-primary transition-colors">
              <LogOut size={20} />
            </button>
            <div className="w-12 h-12 border-2 border-outline bg-surface brutalist-shadow flex items-center justify-center font-black text-xl hover:bg-primary hover:text-on-primary transition-colors cursor-pointer overflow-hidden" onClick={() => setActiveNav('profile')}>
              {profile?.avatar ? <img src={profile.avatar} alt="Me" className="w-full h-full object-cover" /> : profile?.name.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-6 md:p-10">
          <AnimatePresence mode="wait">
             {activeNav === 'feed' && (
               <ScreenWrapper key="feed">
                 <div className="mb-10">
                   <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-4 text-shadow-sm">Campus Forum</h2>
                   <div className="flex flex-wrap gap-2">
                     <FilterChip active label="All Stories" />
                     <FilterChip label="Facilities" />
                     <FilterChip label="IT" />
                     <FilterChip label="Social" />
                   </div>
                 </div>
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                    {filteredPosts.map((post) => (
                      <PostCard 
                        key={post.id} 
                        post={post} 
                        onVote={handleVote}
                        onAddComment={handleAddComment}
                        userId={user?.uid || ''}
                      />
                    ))}
                 </div>
               </ScreenWrapper>
             )}

             {activeNav === 'reports' && (
               <ScreenWrapper key="reports">
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-10 text-shadow-sm">My Activity</h2>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                    {posts.filter(p => p.authorId === user.uid).map((post) => (
                      <PostCard 
                        key={post.id} 
                        post={post} 
                        onVote={handleVote}
                        onAddComment={handleAddComment}
                        onDelete={() => handleDeletePost(post.id)}
                        userId={user.uid}
                      />
                    ))}
                    {posts.filter(p => p.authorId === user.uid).length === 0 && (
                      <div className="col-span-full py-20 border-2 border-dashed border-outline flex flex-col items-center justify-center text-center opacity-30">
                        <Rss size={48} className="mb-4" />
                        <h3 className="text-2xl font-black uppercase">No posts yet</h3>
                        <p>Your side of the broadside is currently blank.</p>
                      </div>
                    )}
                  </div>
               </ScreenWrapper>
             )}

             {activeNav === 'profile' && (
               <ScreenWrapper key="profile">
                  <div className="max-w-4xl">
                    <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
                       <div className="w-40 h-40 border-4 border-outline brutalist-shadow bg-surface-variant p-2 grayscale hover:grayscale-0 transition-all duration-500">
                          <img src={profile?.avatar} alt="Avatar" className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-1">
                          <h2 className="text-6xl font-black italic uppercase tracking-tighter mb-4 text-shadow-sm">{profile?.name}</h2>
                          <div className="flex flex-wrap gap-2 mb-6">
                             <span className="px-3 py-1 bg-on-surface text-white text-[10px] font-black uppercase tracking-widest">Forum Veteran</span>
                             <span className="px-3 py-1 border-2 border-outline text-[10px] font-black uppercase tracking-widest">{profile?.department}</span>
                          </div>
                          <p className="text-lg font-medium leading-relaxed max-w-xl opacity-80">
                            {profile?.biography}
                          </p>
                       </div>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 bg-surface p-8 border-2 border-outline brutalist-shadow">
                       <div className="col-span-full border-b-2 border-outline pb-4 mb-4">
                          <h3 className="text-xl font-black uppercase tracking-widest">Update Credentials</h3>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary">Department</label>
                          <input name="department" defaultValue={profile?.department} className="w-full bg-background border-2 border-outline p-4 font-bold focus:outline-none focus:bg-surface-variant transition-colors" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary">Short Bio</label>
                          <textarea name="biography" defaultValue={profile?.biography} className="w-full bg-background border-2 border-outline p-4 font-medium focus:outline-none focus:bg-surface-variant transition-colors resize-none" rows={3} />
                       </div>
                       <button type="submit" className="col-span-full p-4 bg-on-surface text-white font-black uppercase tracking-widest border-2 border-outline hover:bg-primary transition-colors">
                          Synchronize Identity
                       </button>
                    </form>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <StatCard label="Forum Posts" value={posts.filter(p => p.authorId === user.uid).length} />
                       <StatCard label="Impact" value={profile?.impactPoints || 0} />
                       <StatCard label="Verification" value="G-MAIL" />
                    </div>
                  </div>
               </ScreenWrapper>
             )}
          </AnimatePresence>
        </main>
      </div>

      {/* Post Modal */}
      <AnimatePresence>
        {isPostModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-secondary/80 backdrop-blur-md" onClick={() => setIsPostModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }} className="relative bg-surface border-4 border-outline brutalist-shadow w-full max-w-xl p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-4xl font-black italic uppercase italic">Post to Forum</h3>
                <button onClick={() => setIsPostModalOpen(false)} className="w-10 h-10 border-2 border-outline flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-6 text-sm">
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest">Headline</label>
                   <input name="title" required placeholder="What's the context?" className="w-full bg-background border-2 border-outline p-4 font-artistic text-xl focus:outline-none focus:bg-surface-variant" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest">Category</label>
                      <select name="category" className="w-full bg-background border-2 border-outline p-4 font-bold appearance-none focus:outline-none">
                        <option>Social</option>
                        <option>Facilities</option>
                        <option>Academic</option>
                        <option>IT Support</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest">Location URL (Optional)</label>
                      <input name="locationUrl" type="url" placeholder="GMap Link..." className="w-full bg-background border-2 border-outline p-4 font-bold focus:outline-none" />
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest">Media Capture</label>
                   <div className="flex gap-4">
                      <label className="flex-1 cursor-pointer group">
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" 
                          onChange={handleMediaChange}
                          className="hidden" 
                        />
                        <div className="border-2 border-outline border-dashed p-4 flex flex-col items-center justify-center gap-2 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                          <Camera size={20} />
                          <span className="text-[8px] font-black uppercase">Photo</span>
                        </div>
                      </label>
                      <label className="flex-1 cursor-pointer group">
                        <input 
                          type="file" 
                          accept="video/*" 
                          capture="environment" 
                          onChange={handleMediaChange}
                          className="hidden" 
                        />
                        <div className="border-2 border-outline border-dashed p-4 flex flex-col items-center justify-center gap-2 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                          <Video size={20} />
                          <span className="text-[8px] font-black uppercase">Video</span>
                        </div>
                      </label>
                      <label className="flex-1 cursor-pointer group">
                        <input 
                          type="file" 
                          accept="image/*,video/*" 
                          onChange={handleMediaChange}
                          className="hidden" 
                        />
                        <div className="border-2 border-outline border-dashed p-4 flex flex-col items-center justify-center gap-2 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                          <Paperclip size={20} />
                          <span className="text-[8px] font-black uppercase">File</span>
                        </div>
                      </label>
                   </div>
                </div>

                {mediaPreview && (
                  <div className="relative border-2 border-outline bg-on-surface aspect-video overflow-hidden">
                    {mediaPreview.type === 'image' ? (
                      <img src={mediaPreview.url} className="w-full h-full object-cover" />
                    ) : (
                      <video src={mediaPreview.url} className="w-full h-full object-cover" controls />
                    )}
                    <button 
                      type="button"
                      onClick={() => setMediaPreview(null)}
                      className="absolute top-2 right-2 w-8 h-8 bg-secondary text-on-secondary flex items-center justify-center border-2 border-outline"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest">Main Content</label>
                   <textarea name="description" required rows={4} placeholder="Speak your mind..." className="w-full bg-background border-2 border-outline p-4 font-medium focus:outline-none resize-none" />
                </div>

                <button type="submit" className="w-full p-6 bg-secondary text-on-secondary font-black uppercase tracking-widest text-lg border-2 border-outline brutalist-shadow active:translate-x-1 active:translate-y-1 transition-transform flex items-center justify-center gap-3">
                  <Send size={24} />
                  Spread the word
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-surface border-t-2 border-outline z-50 flex justify-around items-center px-4">
        <MobileNavButton active={activeNav === 'feed'} onClick={() => setActiveNav('feed')} icon={<Rss size={20} />} label="Forum" />
        <MobileNavButton active={activeNav === 'reports'} onClick={() => setActiveNav('reports')} icon={<FileText size={20} />} label="Activity" />
        <MobileNavButton active={activeNav === 'profile'} onClick={() => setActiveNav('profile')} icon={<UserIcon size={20} />} label="Me" />
      </nav>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-secondary text-on-secondary border-2 border-outline p-4 brutalist-shadow text-[10px] font-black uppercase tracking-widest pointer-events-none">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const AuthScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div className="h-screen w-full flex items-center justify-center bg-background p-6">
    <div className="max-w-md w-full bg-surface border-4 border-outline p-12 brutalist-shadow text-center space-y-10">
      <div className="space-y-2">
        <TrendingUp size={64} className="mx-auto text-primary" />
        <h1 className="text-6xl font-black uppercase italic tracking-tighter leading-none">Campus<br/>Wall</h1>
        <p className="text-[10px] font-black tracking-[0.3em] uppercase opacity-60">The Digital Broadside</p>
      </div>

      <p className="text-sm font-medium leading-relaxed">
        Authenticate your identity to join the campus collective. Voices are archived on-chain for accountability and community progress.
      </p>

      <button 
        onClick={onLogin}
        className="w-full p-6 bg-secondary text-on-secondary font-black uppercase tracking-widest text-lg border-2 border-outline brutalist-shadow hover:-translate-y-1 active:translate-y-0 transition-transform flex items-center justify-center gap-4"
      >
        <Mail size={24} />
        Sign in with G-Mail
      </button>

      <p className="text-[10px] font-bold opacity-40 uppercase">Academic integrity enforced</p>
    </div>
  </div>
);

const PostCard: React.FC<{ 
  post: Post, 
  onVote: (id: string, type: 'up' | 'down') => void, 
  onAddComment: (id: string, text: string) => void, 
  onDelete?: () => void,
  userId: string 
}> = ({ post, onVote, onAddComment, onDelete, userId }) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<{ id: string, authorName: string, text: string, createdAt: any }[]>([]);

  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any);
    });
    return unsubscribe;
  }, [showComments, post.id]);

  const submitComment = () => {
    onAddComment(post.id, commentText);
    setCommentText('');
  };

  const currentVote = post.voters?.[userId] || 0;

  return (
    <motion.article layout className="p-6 brutalist-card bg-surface flex flex-col relative group/card border-outline border-2">
      {onDelete && (
        <button onClick={onDelete} className="absolute -top-3 -right-3 w-8 h-8 bg-secondary text-on-secondary border-2 border-outline flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity z-10 hover:bg-primary">
          <X size={16} />
        </button>
      )}

      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 border-2 border-outline rounded-full overflow-hidden grayscale">
          <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase leading-none">{post.authorName}</span>
          <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mt-1 opacity-60">{post.authorDept}</span>
        </div>
        <div className="ml-auto">
          <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border border-outline ${post.status === 'Urgent' ? 'bg-primary text-on-primary' : 'bg-on-surface text-white'}`}>
            {post.status}
          </span>
        </div>
      </div>

      <h3 className="text-2xl font-artistic italic leading-tight mb-3">
        {post.title}
      </h3>
      
      <p className="text-sm font-medium mb-6 text-on-surface-variant leading-relaxed">
        {post.content}
      </p>

      {post.mediaUrl && (
        <div className="border-2 border-outline bg-on-surface mb-6 overflow-hidden aspect-[16/9] relative group/media">
          <img src={post.mediaUrl} alt="Media" className="w-full h-full object-cover grayscale transition-all duration-700 group-hover/media:grayscale-0 group-hover/media:scale-105" referrerPolicy="no-referrer" />
          {post.mediaType === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center bg-secondary/20 pointer-events-none">
              <div className="w-12 h-12 bg-white rounded-full border-2 border-outline flex items-center justify-center">
                <Plus size={24} className="rotate-45" />
              </div>
            </div>
          )}
        </div>
      )}

      {post.locationUrl && (
        <a href={post.locationUrl} target="_blank" rel="noopener noreferrer" className="mb-6 p-3 border-2 border-outline text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-colors flex items-center justify-center gap-2">
          <MapIcon size={14} /> Open Location
        </a>
      )}

      <div className="pt-4 border-t-2 border-outline/10 mt-auto flex items-center justify-between">
        <div className="flex items-center border-2 border-outline overflow-hidden rounded">
           <button onClick={() => onVote(post.id, 'up')} className={`p-2 transition-colors border-r-2 border-outline ${currentVote === 1 ? 'bg-primary text-on-primary' : 'hover:bg-surface-variant'}`}>
              <ThumbsUp size={16} />
           </button>
           <div className="px-3 text-xs font-black bg-surface-container-low min-w-[3rem] text-center">
              {post.upvotes - post.downvotes}
           </div>
           <button onClick={() => onVote(post.id, 'down')} className={`p-2 transition-colors border-l-2 border-outline ${currentVote === -1 ? 'bg-secondary text-on-secondary' : 'hover:bg-surface-variant'}`}>
              <ThumbsDown size={16} />
           </button>
        </div>

        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group">
          <MessageSquare size={18} />
          <span className="text-[10px] font-black uppercase tracking-tighter">{post.commentsCount} Discussion</span>
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-6 overflow-hidden">
             <div className="space-y-4 pt-4 border-t-2 border-outline/5">
                {comments.length > 0 ? comments.map(c => (
                  <div key={c.id} className="p-3 bg-surface-variant/30 border-l-2 border-primary">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase">{c.authorName}</span>
                    </div>
                    <p className="text-xs font-medium">{c.text}</p>
                  </div>
                )) : (
                  <p className="text-[10px] text-center opacity-40 uppercase font-black py-4">Silence in the forum... be the first.</p>
                )}
                <div className="flex gap-2 pt-2">
                  <input 
                    type="text" 
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                    placeholder="Add to the scroll..." 
                    className="flex-1 bg-background border-2 border-outline px-3 py-1.5 text-xs focus:outline-none" 
                  />
                  <button onClick={submitComment} className="bg-secondary text-on-secondary px-4 border-2 border-outline hover:bg-primary transition-colors">
                    <Send size={14} />
                  </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

const DesktopNavLink = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-4 text-2xl font-artistic transition-all w-full text-left group
      ${active ? 'border-b-2 border-outline pb-1' : 'text-on-surface-variant hover:text-on-surface'}`}
  >
    <span className={`transition-transform group-hover:scale-110 ${active ? 'text-primary' : ''}`}>
      {icon}
    </span>
    {label}
  </button>
);

const FilterChip = ({ label, active }: { label: string, active?: boolean }) => (
  <button className={`px-4 py-1.5 border-2 border-outline text-[10px] font-black uppercase tracking-widest transition-colors
    ${active ? 'bg-on-surface text-white' : 'bg-surface hover:bg-surface-variant'}`}>
    {label}
  </button>
);

const StatCard = ({ label, value }: { label: string, value: string | number }) => (
  <div className="p-8 border-2 border-outline brutalist-shadow bg-surface hover:-translate-y-1 transition-transform cursor-pointer">
    <h4 className="text-[10px] font-black uppercase tracking-widest mb-4">{label}</h4>
    <span className="text-6xl font-artistic leading-none">{value}</span>
  </div>
);

const ScreenWrapper = ({ children }: { children: ReactNode, key?: string }) => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

function MobileNavButton({ active, icon, label, onClick }: { active: boolean, icon: ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all ${
        active 
          ? 'text-primary' 
          : 'text-on-surface-variant'
      }`}
    >
      <div className={`${active ? 'scale-125 border-b-2 border-primary pb-1' : ''} transition-all`}>
        {icon}
      </div>
      <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}
