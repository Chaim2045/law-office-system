/**
 * Firebase Type Declarations
 * קובץ טיפוסים ל-Firebase compatibility mode
 */

declare namespace firebase {
  namespace firestore {
    interface Firestore {
      collection(path: string): CollectionReference;
    }

    interface CollectionReference {
      doc(documentPath: string): DocumentReference;
      add(data: any): Promise<DocumentReference>;
      get(): Promise<QuerySnapshot>;
      where(fieldPath: string, opStr: WhereFilterOp, value: any): Query;
      orderBy(fieldPath: string, directionStr?: OrderByDirection): Query;
      limit(limit: number): Query;
    }

    interface DocumentReference {
      id: string;
      get(): Promise<DocumentSnapshot>;
      set(data: any): Promise<void>;
      update(data: any): Promise<void>;
      delete(): Promise<void>;
    }

    interface Query {
      where(fieldPath: string, opStr: WhereFilterOp, value: any): Query;
      orderBy(fieldPath: string, directionStr?: OrderByDirection): Query;
      limit(limit: number): Query;
      startAfter(snapshot: QueryDocumentSnapshot): Query;
      get(): Promise<QuerySnapshot>;
    }

    interface QuerySnapshot {
      docs: QueryDocumentSnapshot[];
      forEach(callback: (doc: QueryDocumentSnapshot) => void): void;
    }

    interface DocumentSnapshot {
      id: string;
      exists: boolean;
      data(): DocumentData | undefined;
    }

    interface QueryDocumentSnapshot extends DocumentSnapshot {
      data(): DocumentData;
    }

    interface DocumentData {
      [field: string]: any;
    }

    type WhereFilterOp = '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in';
    type OrderByDirection = 'desc' | 'asc';

    class FieldValue {
      static serverTimestamp(): FieldValue;
      static delete(): FieldValue;
      static increment(n: number): FieldValue;
    }

    interface Timestamp {
      toDate(): Date;
      seconds: number;
      nanoseconds: number;
    }
  }
}
