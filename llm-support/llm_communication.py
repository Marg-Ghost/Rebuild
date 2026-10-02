import ollama
import vectordb

# ein auf 2 Request typen getielte Que

class LlmRequest:
    def __init__(self, content, request_type):
        self.content = content
        self.request_type = request_type
        self.nachfolger = None

    def get_content(self):
        return self.content
    def set_nachfolger(self, nachfolger):
        self.nachfolger = nachfolger

    def get_nachfolger(self):
        return self.nachfolger

class LlmRequestQueue:
    def __init__(self):
        self.head = None
        self.tail = None

    def enqueue(self, request):
        if not self.head:
            self.head = request
            self.tail = request
        else:
            self.tail.set_nachfolger(request)
            self.tail = request

    def dequeue(self):
        if not self.head:
            return None
        removed_request = self.head
        self.head = self.head.get_nachfolger()
        if not self.head:
            self.tail = None
        return removed_request

