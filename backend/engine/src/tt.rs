use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};

pub const BOUND_EXACT: u8 = 1;
pub const BOUND_LOWER: u8 = 2;
pub const BOUND_UPPER: u8 = 3;

#[derive(Clone, Copy, Default)]
pub struct Entry {
    pub mv: u16,
    pub score: i16,
    pub depth: i8,
    pub bound: u8,
    pub generation: u8,
}

impl Entry {
    fn pack(self) -> u64 {
        self.mv as u64
            | ((self.score as u16 as u64) << 16)
            | ((self.depth as u8 as u64) << 32)
            | ((self.bound as u64) << 40)
            | ((self.generation as u64) << 48)
    }

    fn unpack(d: u64) -> Entry {
        Entry {
            mv: d as u16,
            score: (d >> 16) as u16 as i16,
            depth: (d >> 32) as u8 as i8,
            bound: (d >> 40) as u8,
            generation: (d >> 48) as u8,
        }
    }
}

/// Lock-free table shared by all search threads. Each slot stores `key ^ data` next to `data`,
/// so a torn write from a concurrent thread fails the key check instead of returning garbage.
pub struct TT {
    table: Vec<[AtomicU64; 2]>,
    mask: usize,
    generation: AtomicU8,
    /// Set by the first store after a clear; `clear()` on a clean table is free.
    dirty: AtomicBool,
}

impl TT {
    pub fn new(mb: usize) -> TT {
        let bytes = mb.max(1) << 20;
        let mut n = 1usize;
        while n * 2 * 16 <= bytes {
            n *= 2;
        }
        let tt = TT {
            table: (0..n).map(|_| [AtomicU64::new(0), AtomicU64::new(0)]).collect(),
            mask: n - 1,
            generation: AtomicU8::new(0),
            dirty: AtomicBool::new(false),
        };
        // The allocator hands back lazily-zeroed pages, so the first write to each page faults. Touch them
        // all now, at startup or `setoption Hash`, where no move clock is running. Otherwise the 5 s rule
        // pays for it: the first `ucinewgame` (sent inside the runner's clock) took 60-200 ms.
        tt.wipe();
        tt
    }

    fn wipe(&self) {
        for slot in &self.table {
            slot[0].store(0, Ordering::Relaxed);
            slot[1].store(0, Ordering::Relaxed);
        }
        self.generation.store(0, Ordering::Relaxed);
        self.dirty.store(false, Ordering::Relaxed);
    }

    /// Called on `ucinewgame`. Skips the wipe when nothing was stored since the last one: the runner starts
    /// a fresh engine process per game, so its `ucinewgame` costs nothing on our move clock.
    pub fn clear(&self) {
        if self.dirty.load(Ordering::Relaxed) {
            self.wipe();
        }
    }

    pub fn new_search(&self) {
        self.generation.fetch_add(1, Ordering::Relaxed);
    }

    #[inline]
    fn slot(&self, key: u64) -> &[AtomicU64; 2] {
        &self.table[key as usize & self.mask]
    }

    #[inline]
    pub fn probe(&self, key: u64) -> Option<Entry> {
        let s = self.slot(key);
        let k = s[0].load(Ordering::Relaxed);
        let d = s[1].load(Ordering::Relaxed);
        if k ^ d != key {
            return None;
        }
        let e = Entry::unpack(d);
        (e.bound != 0).then_some(e)
    }

    #[inline]
    pub fn store(&self, key: u64, mv: u16, score: i32, depth: i32, bound: u8) {
        let generation = self.generation.load(Ordering::Relaxed);
        let s = self.slot(key);
        let old_d = s[1].load(Ordering::Relaxed);
        let same = s[0].load(Ordering::Relaxed) ^ old_d == key;
        let old = Entry::unpack(old_d);
        if !self.dirty.load(Ordering::Relaxed) {
            // Read-mostly flag: written once per game, so threads don't fight over its cache line.
            self.dirty.store(true, Ordering::Relaxed);
        }
        if !same || old.generation != generation || depth + 2 >= old.depth as i32 || bound == BOUND_EXACT {
            let e = Entry {
                mv: if mv == 0 && same { old.mv } else { mv },
                score: score as i16,
                depth: depth.clamp(-1, 127) as i8,
                bound,
                generation,
            };
            let d = e.pack();
            s[0].store(key ^ d, Ordering::Relaxed);
            s[1].store(d, Ordering::Relaxed);
        }
    }
}
