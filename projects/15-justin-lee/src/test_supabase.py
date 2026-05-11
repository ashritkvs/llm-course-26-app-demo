from supabase import create_client
import os

url = "https://aiprsdckowtyakbwpjpx.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcHJzZGNrb3d0eWFrYndwanB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM3NDMzMiwiZXhwIjoyMDg4OTUwMzMyfQ.l2CkS79TLH7uJcfGkoIZqvXFelNmndqMkoRV-KFgOBA"
client = create_client(url, key)
print("Client created")
